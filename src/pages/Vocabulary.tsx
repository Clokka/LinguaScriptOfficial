import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Volume2, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/LevelBadge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { DeckState, STATE_META, coerceDeckState } from "@/lib/vocab";
import { getGuestWords } from "@/lib/guestWords";
import { cn } from "@/lib/utils";
import { WordDetailModal } from "@/components/WordDetailModal";

interface DeckWord {
  id: string;
  word: string;
  translation: string;
  state: DeckState;
  state_changed_at?: string | null;
}

// Three universal vocabulary states, shared across every language and every
// surface (subtitles, flashcards, dashboard, comprehension engine).
// "Recognized" = words the system assumes you know based on your CEFR level
// (cascaded: picking B1 inherits A1+A2+B1). These are seeded as green
// saved_words by `seed_known_vocabulary` so subtitles render them green too.
const DECKS: { key: DeckState; title: string; subtitle: string }[] = [
  { key: "green",  title: "Recognized Vocabulary", subtitle: "From your level — assumed known" },
  { key: "orange", title: "Learning",              subtitle: "Actively reviewing" },
  { key: "red",    title: "Unknown",               subtitle: "Encountered, not yet learned" },
];

export default function Vocabulary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { speak, learningLanguage } = useLanguage();

  const [words, setWords] = useState<DeckWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | DeckState>("all");
  const [search, setSearch] = useState("");
  const [coreTotal, setCoreTotal] = useState<number | null>(null);
  const [detailWord, setDetailWord] = useState<DeckWord | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const lang = learningLanguage || "fr";

      // High-frequency vocabulary size for this language (basis for "unassessed" estimate).
      supabase
        .from("core_vocabulary")
        .select("id", { count: "exact", head: true })
        .eq("language", lang)
        .then(({ count }) => { if (alive) setCoreTotal(count ?? 0); });

      if (!user) {
        const guest = getGuestWords()
          .filter((g) => g.language === lang)
          .map<DeckWord>((g) => ({
            id: g.id,
            word: g.word,
            translation: g.translation,
            state: "red",
          }));
        if (alive) {
          setWords(guest);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase
        .from("saved_words")
        .select("id, word, translation, state, state_changed_at")
        .eq("user_id", user.id)
        .eq("language", lang)
        .order("created_at", { ascending: false });
      if (!alive) return;
      setWords(
        ((data as any[]) || []).map((w) => ({ ...w, state: coerceDeckState(w.state) })) as DeckWord[],
      );
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, learningLanguage]);

  const counts = useMemo(() => {
    const c: Record<DeckState, number> = { red: 0, orange: 0, green: 0 };
    for (const w of words) c[w.state] = (c[w.state] ?? 0) + 1;
    return c;
  }, [words]);

  // ⚪ Unassessed = high-frequency words in this language we haven't seen the
  // learner save yet. Never goes negative; falls back to 0 until we know.
  const unassessed = useMemo(() => {
    if (coreTotal == null) return null;
    return Math.max(0, coreTotal - words.length);
  }, [coreTotal, words.length]);

  const learnedThisWeek = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return words.filter(
      (w) => w.state === "green" && w.state_changed_at && new Date(w.state_changed_at).getTime() >= since,
    ).length;
  }, [words]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return words.filter((w) => {
      if (filter !== "all" && w.state !== filter) return false;
      if (q && !w.word.toLowerCase().includes(q) && !(w.translation || "").toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [words, filter, search]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/discover")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Your Vocabulary</h1>
          <div className="ml-auto"><LevelBadge /></div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Confidence-first hero: surface Recognized Vocabulary front and centre. */}
        <section className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <p className="text-xs uppercase tracking-wider text-emerald-400/80 font-semibold">Recognized vocabulary</p>
          <p className="text-5xl font-bold tabular-nums text-emerald-300 mt-1">
            {counts.green.toLocaleString()}
            {coreTotal != null && (
              <span className="text-base text-muted-foreground font-normal ml-2">
                / ~{coreTotal.toLocaleString()} high-frequency words
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            You already know more than you think. These words are inherited from your CEFR level and treated as known across subtitles, flashcards, and comprehension scoring.
          </p>
        </section>

        {/* Three-state overview: Recognized · Learning · Unknown */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DECKS.map((d, i) => {
            const meta = STATE_META[d.key];
            return (
              <motion.button
                key={d.key}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 * i }}
                onClick={() => setFilter(d.key)}
                className={cn(
                  "text-left rounded-2xl border p-5 transition hover:scale-[1.01]",
                  meta.bg,
                  meta.border,
                  filter === d.key && "ring-2 ring-offset-2 ring-offset-background",
                  filter === d.key && meta.ring,
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-2.5 h-2.5 rounded-full", meta.dot)} />
                  <p className="font-semibold text-foreground">{d.title}</p>
                </div>
                <p className="text-4xl font-bold tabular-nums">{counts[d.key]}</p>
                <p className="text-xs text-muted-foreground mt-1">{d.subtitle}</p>
              </motion.button>
            );
          })}

        </section>

        {/* Totals */}
        <section className="grid grid-cols-2 gap-4">
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground/70">Total saved</p>
            <p className="text-3xl font-bold mt-1 tabular-nums">{words.length}</p>
          </div>
          <div className="glass-panel rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground/70">Learned this week</p>
            <p className="text-3xl font-bold mt-1 tabular-nums text-emerald-500">+{learnedThisWeek}</p>
          </div>
        </section>

        <div className="flex justify-end">
          <Button onClick={() => navigate("/flashcards")} className="gap-2">
            <BookOpen className="w-4 h-4" /> Review flashcards
          </Button>
        </div>

        {/* Filter + search */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "red", "orange", "green"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition",
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {f === "all" ? "All" : STATE_META[f].label}
              </button>
            ))}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No words here yet. Click any word in subtitles to save it.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((w) => {
                const meta = STATE_META[w.state];
                return (
                  <div
                    key={w.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailWord(w)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setDetailWord(w);
                      }
                    }}
                    className="text-left rounded-xl border border-border/60 p-4 bg-card/50 transition hover:bg-card flex items-start justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", meta.dot)} />
                        <p className="font-semibold text-foreground truncate">{w.word}</p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{w.translation}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        speak(w.word, learningLanguage);
                      }}
                      title="Pronounce"
                    >
                      <Volume2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {detailWord && (
        <WordDetailModal
          open={!!detailWord}
          onClose={() => setDetailWord(null)}
          word={detailWord.word}
          translation={detailWord.translation}
          language={learningLanguage || "fr"}
          state={detailWord.state}
          speak={speak}
        />
      )}
    </div>
  );
}
