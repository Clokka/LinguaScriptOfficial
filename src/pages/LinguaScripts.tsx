import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { LinguaScriptSession } from "@/components/LinguaScriptSession";
import { useDailyWordGoal } from "@/hooks/useDailyWordGoal";
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

  const load = useCallback(async () => {
    if (!user || !learningLanguage) return;
    setLoading(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const now = new Date();
      const tomorrowEnd = new Date(start.getTime() + 2 * 86400000);
      const weekEnd = new Date(start.getTime() + 8 * 86400000);

      const [all, reviews, words, cov] = await Promise.all([
        supabase
          .from("linguascripts")
          .select("id, target_word, scheduled_for")
          .eq("user_id", user.id)
          .eq("language", learningLanguage)
          .is("completed_at", null)
          .lte("scheduled_for", weekEnd.toISOString())
          .order("scheduled_for", { ascending: true })
          .limit(1000),
        supabase
          .from("linguascript_reviews")
          .select("linguascript_id")
          .eq("user_id", user.id)
          .gte("created_at", start.toISOString()),
        supabase
          .from("saved_words")
          .select("word, state, frequency_rank, next_review")
          .eq("user_id", user.id)
          .eq("language", learningLanguage)
          .limit(20000),
        supabase.rpc("frequency_coverage" as any, { _language: learningLanguage }),
      ]);

      const rows = (all.data || []) as Row[];
      const done = new Set(((reviews.data || []) as any[]).map((r) => r.linguascript_id)).size;
      const wordRows = (words.data || []) as any[];
      const rank = new Map<string, number>();
      const d = { red: 0, orange: 0, green: 0 };
      for (const w of wordRows) {
        if (w.frequency_rank) rank.set(String(w.word).toLowerCase(), w.frequency_rank);
        if (w.state in d) (d as any)[w.state]++;
      }

      const covRow: any = Array.isArray(cov.data) ? cov.data[0] : cov.data;
      const currentBand: number | null = covRow?.band ?? null;

      // Due now, current frequency milestone first, then most common first.
      const due = rows
        .filter((r) => new Date(r.scheduled_for) <= now)
        .sort((a, b) => {
          const ra = rank.get(a.target_word.toLowerCase()) ?? 99999;
          const rb = rank.get(b.target_word.toLowerCase()) ?? 99999;
          const ia = currentBand && ra <= currentBand ? 0 : 1;
          const ib = currentBand && rb <= currentBand ? 0 : 1;
          return ia - ib || ra - rb;
        });

      const remaining = Math.max(0, dailyGoal - done);
      setQueue(due.slice(0, remaining).map((r) => r.id));
      setDoneToday(done);
      setHasAny(rows.length > 0 || done > 0);
      setSoon({
        tomorrow: rows.filter((r) => new Date(r.scheduled_for) > now && new Date(r.scheduled_for) < tomorrowEnd).length,
        week: rows.filter((r) => new Date(r.scheduled_for) > now).length,
      });
      setDecks(d);
      setBand(currentBand);
    } catch (e) {
      console.error("LinguaScripts load failed", e);
    } finally {
      setLoading(false);
    }
  }, [user, learningLanguage, dailyGoal]);

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
