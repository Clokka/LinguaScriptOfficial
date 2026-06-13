import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Search, Volume2, Sparkles, Languages, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  CoreWord,
  STATE_META,
  VocabState,
  comprehensionPercent,
  countByState,
  loadCoreVocabulary,
  loadUserVocabState,
  recordReview,
  UserVocabRow,
} from "@/lib/vocab";
import { cn } from "@/lib/utils";

type Filter = "all" | VocabState;
type Band = "all" | "1-100" | "101-500" | "501-1500" | "1501-3000";

const BANDS: { key: Band; label: string; min: number; max: number }[] = [
  { key: "all",        label: "All ranks",    min: 1, max: 99999 },
  { key: "1-100",      label: "Top 100",      min: 1, max: 100 },
  { key: "101-500",    label: "101–500",      min: 101, max: 500 },
  { key: "501-1500",   label: "501–1500",     min: 501, max: 1500 },
  { key: "1501-3000",  label: "1501–3000",    min: 1501, max: 3000 },
];

export default function Vocabulary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { speak } = useLanguage();

  const [words, setWords] = useState<CoreWord[]>([]);
  const [states, setStates] = useState<Map<string, UserVocabRow>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [band, setBand] = useState<Band>("all");
  const [pos, setPos] = useState<string>("all");

  useEffect(() => {
    let alive = true;
    (async () => {
      const w = await loadCoreVocabulary("fr");
      const s = user ? await loadUserVocabState(user.id) : new Map();
      if (!alive) return;
      setWords(w);
      setStates(s);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user]);

  const pct = useMemo(() => comprehensionPercent(words, states), [words, states]);
  const counts = useMemo(() => countByState(words, states), [words, states]);
  const allPos = useMemo(
    () => Array.from(new Set(words.map((w) => w.pos).filter(Boolean))) as string[],
    [words],
  );

  const filtered = useMemo(() => {
    const b = BANDS.find((x) => x.key === band)!;
    const q = search.trim().toLowerCase();
    return words.filter((w) => {
      if (w.rank < b.min || w.rank > b.max) return false;
      if (pos !== "all" && w.pos !== pos) return false;
      if (filter !== "all" && (states.get(w.id)?.state ?? "red") !== filter) return false;
      if (q && !w.word.toLowerCase().includes(q) && !w.translation.toLowerCase().includes(q) && !w.lemma.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [words, states, search, filter, band, pos]);

  const topRed = useMemo(
    () => words.filter((w) => (states.get(w.id)?.state ?? "red") === "red").slice(0, 10),
    [words, states],
  );

  const setLocal = (wordId: string, next: VocabState) => {
    setStates((prev) => {
      const m = new Map(prev);
      const existing = m.get(wordId);
      m.set(wordId, {
        word_id: wordId,
        state: next,
        times_seen: (existing?.times_seen ?? 0) + 1,
        times_correct: (existing?.times_correct ?? 0) + (next === "green" ? 1 : 0),
        promoted_at: next === "green" ? new Date().toISOString() : (existing?.promoted_at ?? null),
      });
      return m;
    });
  };

  const handleMark = async (w: CoreWord, next: VocabState) => {
    setLocal(w.id, next);
    if (!user) return;
    if (next === "green") {
      // Force three correct reviews so it lands on green
      await recordReview(user.id, w.id, true);
      await recordReview(user.id, w.id, true);
      await recordReview(user.id, w.id, true);
    } else if (next === "orange") {
      await recordReview(user.id, w.id, true);
    } else {
      // reset back to red — delete row
      await import("@/integrations/supabase/client").then(({ supabase }) =>
        supabase.from("user_vocabulary_state").delete().eq("user_id", user.id).eq("word_id", w.id),
      );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/browse")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Languages className="w-5 h-5 text-primary" />
            French Comprehension
          </h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Headline comprehension score */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel-strong rounded-3xl p-8"
        >
          <p className="text-xs uppercase tracking-wider text-muted-foreground/70">Overall French comprehension</p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-6xl font-bold gradient-text tabular-nums">{pct}%</span>
            <span className="text-sm text-muted-foreground">
              of everyday French (weighted by frequency)
            </span>
          </div>
          <Progress value={pct} className="mt-5 h-3 bg-secondary" />
          <p className="mt-3 text-sm text-muted-foreground">
            Goal: master the {words.length.toLocaleString()} most important French words
            ({words.length < 3000 ? `seeded so far — expanding to 3,000` : "complete list"}).
          </p>
        </motion.section>

        {/* Stage breakdown */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(["green", "orange", "red"] as VocabState[]).map((s, i) => {
            const meta = STATE_META[s];
            const n = counts[s];
            const labels: Record<VocabState, string> = {
              green: "Known", orange: "Learning", red: "Not yet learned",
            };
            return (
              <motion.div
                key={s}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                className={cn("rounded-2xl border p-5", meta.bg, "border-border/40")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-2.5 h-2.5 rounded-full", meta.dot)} />
                  <p className="font-semibold text-foreground">{labels[s]}</p>
                </div>
                <p className="text-3xl font-bold tabular-nums">{n}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {words.length > 0 ? Math.round((n / words.length) * 100) : 0}% of catalogue
                </p>
              </motion.div>
            );
          })}
        </section>

        {/* Most valuable next words */}
        {topRed.length > 0 && (
          <section className="glass-panel rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-primary" />
              <h2 className="text-lg font-semibold">Most valuable next words</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Learning these will boost your comprehension fastest.
            </p>
            <div className="flex flex-wrap gap-2">
              {topRed.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handleMark(w, "orange")}
                  className="px-3 py-1.5 rounded-full text-sm bg-red-500/10 text-red-500 hover:bg-red-500/20 transition"
                  title={`Mark "${w.word}" as learning`}
                >
                  <span className="font-medium">{w.word}</span>
                  <span className="ml-2 text-muted-foreground">{w.translation}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Vocabulary explorer */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Vocabulary explorer</h2>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search a word or translation…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "red", "orange", "green"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                  filter === f ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {f === "all" ? "All" : STATE_META[f].label}
              </button>
            ))}
            <span className="mx-1 w-px bg-border" />
            {BANDS.map((b) => (
              <button
                key={b.key}
                onClick={() => setBand(b.key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                  band === b.key ? "bg-secondary text-foreground border-secondary" : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {b.label}
              </button>
            ))}
            {allPos.length > 0 && (
              <>
                <span className="mx-1 w-px bg-border" />
                <select
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium border border-border bg-background text-muted-foreground"
                >
                  <option value="all">All parts of speech</option>
                  {allPos.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading vocabulary…</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((w) => {
                const state = (states.get(w.id)?.state ?? "red") as VocabState;
                const meta = STATE_META[state];
                return (
                  <div
                    key={w.id}
                    className={cn(
                      "rounded-xl border border-border/60 p-4 bg-card/50 transition hover:bg-card",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                          <p className="font-semibold text-foreground truncate">{w.word}</p>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            #{w.rank}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{w.translation}</p>
                        {w.example_fr && (
                          <p className="text-xs text-muted-foreground/80 italic mt-2 line-clamp-2">
                            "{w.example_fr}"
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0"
                        onClick={(e) => { e.stopPropagation(); speak(w.word); }}
                        title="Pronounce"
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="mt-3 flex gap-1.5">
                      {(["red", "orange", "green"] as VocabState[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleMark(w, s)}
                          className={cn(
                            "flex-1 text-[11px] font-medium rounded-md py-1.5 border transition",
                            state === s
                              ? cn(STATE_META[s].bg, STATE_META[s].text, "border-transparent")
                              : "border-border text-muted-foreground hover:bg-secondary/60",
                          )}
                        >
                          {STATE_META[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="col-span-full text-sm text-muted-foreground text-center py-8">
                  No words match these filters.
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
