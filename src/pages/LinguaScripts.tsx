import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { LinguaScriptSession } from "@/components/LinguaScriptSession";
import { useDailyWordGoal } from "@/hooks/useDailyWordGoal";
import { headlineBand, loadFrequencyCoverage } from "@/lib/frequencyCoverage";
import { DECK } from "@/lib/deck-colors";
import { getLanguageLabel } from "@/lib/languages";

const GREEN = DECK.green;

interface Row {
  id: string;
  target_word: string;
  scheduled_for: string;
}

/**
 * LinguaScripts hub. Deliberately shows NO words, sentences or translations
 * before the session — previewing them turned recall into copying.
 */
export default function LinguaScripts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const { goal: dailyGoal } = useDailyWordGoal(learningLanguage || undefined);

  const [queue, setQueue] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [doneToday, setDoneToday] = useState(0);
  const [hasAny, setHasAny] = useState(false);
  const [soon, setSoon] = useState({ tomorrow: 0, week: 0 });
  const [decks, setDecks] = useState({ red: 0, orange: 0, green: 0 });
  const [band, setBand] = useState<number | null>(null);
  const [sessionIds, setSessionIds] = useState<string[] | null>(null);

  const reqId = useRef(0);

  const apply = useCallback(
    (d: DueSummary, rank: Map<string, number>) => {
      const now = Date.now();
      const byId = new Map(d.rows.map((r) => [r.id, r]));
      const due = d.dueIds
        .map((id) => byId.get(id)!)
        .filter(Boolean)
        .sort(
          (a, b) =>
            (rank.get(a.target_word.toLowerCase()) ?? 99999) - (rank.get(b.target_word.toLowerCase()) ?? 99999),
        );
      const tomorrowEnd = new Date();
      tomorrowEnd.setHours(0, 0, 0, 0);
      const tEnd = tomorrowEnd.getTime() + 2 * 86400000;
      const future = d.rows.filter((r) => new Date(r.scheduled_for).getTime() > now);
      setQueue(due.slice(0, Math.max(0, dailyGoal - d.doneToday)).map((r) => r.id));
      setDoneToday(d.doneToday);
      setHasAny(d.rows.length > 0 || d.doneToday > 0);
      setSoon({ tomorrow: future.filter((r) => new Date(r.scheduled_for).getTime() < tEnd).length, week: future.length });
    },
    [dailyGoal],
  );

  const load = useCallback(async () => {
    if (!user || !learningLanguage) return;
    const my = ++reqId.current;
    const lang = learningLanguage;
    const cached = cachedDue(user.id, lang);
    if (cached) {
      apply(cached, new Map());
      setLoading(false);
    } else {
      setLoading(true);
    }
    setBand(null);
    loadFrequencyCoverage(lang)
      .then((cov) => my === reqId.current && setBand(headlineBand(cov)?.band ?? null))
      .catch(() => {});
    const deckCount = (state: string) =>
      supabase
        .from("saved_words")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("language", lang)
        .eq("state", state);
    Promise.all([deckCount("red"), deckCount("orange"), deckCount("green")]).then(([r, o, g]) => {
      if (my === reqId.current) setDecks({ red: r.count ?? 0, orange: o.count ?? 0, green: g.count ?? 0 });
    });
    try {
      const d = await loadDue(user.id, lang);
      if (my !== reqId.current) return;
      apply(d, new Map());
      setLoading(false);
      // Most-common-first ordering refines the queue a moment later.
      const words = Array.from(new Set(d.rows.filter((r) => d.dueIds.includes(r.id)).map((r) => r.target_word))).slice(0, 300);
      if (words.length) {
        const { data: rk } = await supabase
          .from("saved_words")
          .select("word, frequency_rank")
          .eq("user_id", user.id)
          .eq("language", lang)
          .in("word", words);
        if (my !== reqId.current) return;
        const rank = new Map<string, number>();
        for (const w of (rk || []) as any[]) if (w.frequency_rank) rank.set(String(w.word).toLowerCase(), w.frequency_rank);
        apply(d, rank);
      }
    } catch (e) {
      console.error("LinguaScripts load failed", e);
      if (my === reqId.current) setLoading(false);
    }
  }, [user, learningLanguage, apply]);

  useEffect(() => {
    load();
  }, [load]);

  if (sessionIds) {
    return (
      <LinguaScriptSession
        exerciseIds={sessionIds}
        onSessionComplete={async () => {
          setSessionIds(null);
          await load();
        }}
      />
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Please log in
      </div>
    );
  }

  const langName = learningLanguage ? getLanguageLabel(learningLanguage) : "";
  const target = Math.min(dailyGoal, doneToday + queue.length) || dailyGoal;
  const pct = target ? Math.min(100, Math.round((doneToday / target) * 100)) : 0;
  const allDone = queue.length === 0 && doneToday > 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-xl items-center gap-3 px-4 pb-2 pt-6">
        <button
          onClick={() => navigate("/discover")}
          aria-label="Back"
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold">LinguaScripts</h1>
          <p className="text-sm text-muted-foreground">
            {band ? `Top ${band.toLocaleString()} words` : "Frequency practice"}
            {langName ? ` · ${langName}` : ""}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-7 w-7 animate-spin" style={{ color: GREEN }} />
          </div>
        ) : (
          <>
            <section
              className="rounded-2xl border p-6"
              style={{ borderColor: `${GREEN}55`, background: `${GREEN}14` }}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
                LinguaScripts
              </p>

              {!hasAny ? (
                <>
                  <h2 className="text-2xl font-extrabold leading-tight">No words to review yet</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Save words while watching and they'll show up here.
                  </p>
                  <GreenButton onClick={() => navigate("/discover")}>Watch a video</GreenButton>
                </>
              ) : allDone ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: GREEN }}>
                      <Check className="h-5 w-5 text-background" />
                    </span>
                    <h2 className="text-2xl font-extrabold">All done for today</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {doneToday} reviewed. Come back tomorrow.
                  </p>
                  <Bar pct={100} />
                  <GreenButton onClick={() => navigate("/discover")}>Watch a video</GreenButton>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-extrabold leading-tight">
                    <span style={{ color: GREEN }}>{queue.length}</span> word{queue.length !== 1 ? "s" : ""} to review today
                  </h2>
                  <Bar pct={pct} />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {doneToday} / {target} done · +{queue.length * 15} XP
                  </p>
                  {queue.length > 0 && (
                    <GreenButton onClick={() => setSessionIds(queue)}>Start review</GreenButton>
                  )}
                </>
              )}
            </section>

            {hasAny && (
              <section className="mt-6 rounded-2xl border border-border p-5">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Coming back soon</p>
                <p className="mt-2 text-sm">
                  Tomorrow <b>{soon.tomorrow}</b> · This week <b>{soon.week}</b>
                </p>
              </section>
            )}

            <section className="mt-4 rounded-2xl border border-border p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your decks</p>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {([
                  ["red", "New"],
                  ["orange", "Learning"],
                  ["green", "Known"],
                ] as const).map(([k, label]) => (
                  <div key={k}>
                    <div className="text-2xl font-extrabold" style={{ color: DECK[k] }}>
                      {decks[k].toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: GREEN }} />
    </div>
  );
}

function GreenButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-background transition-opacity hover:opacity-90"
      style={{ background: GREEN }}
    >
      {children} <ArrowRight className="h-4 w-4" />
    </button>
  );
}
