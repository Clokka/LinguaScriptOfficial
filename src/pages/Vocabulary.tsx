import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Volume2, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LevelBadge } from "@/components/LevelBadge";
import { BrandMark } from "@/components/BrandMark";
import { FrequencyCoverageCard } from "@/components/FrequencyCoverageCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { DeckState, STATE_META, coerceDeckState } from "@/lib/vocab";
import { getGuestWords } from "@/lib/guestWords";
import { cn } from "@/lib/utils";
import { GlassCard, CountUp, PremiumHeader, Eyebrow, Skeleton, type Accent } from "@/components/premium";
import "@/components/premium/cinema.css";

interface DeckWord {
  id: string;
  word: string;
  translation: string;
  state: DeckState;
  state_changed_at?: string | null;
  created_at?: string | null;
}

// Three universal vocabulary states, shared across every language and every
// surface (subtitles, flashcards, dashboard, comprehension engine).
// "Recognized" = words the system assumes you know based on your CEFR level
// (cascaded: picking B1 inherits A1+A2+B1). These are seeded as green
// saved_words by `seed_known_vocabulary` so subtitles render them green too.
const DECK_ACCENT: Record<DeckState, Accent> = { green: "green", orange: "orange", red: "red" };
const PAGE = 120;

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
  // Exact per-deck counts come back in one fast round trip, long before the
  // full word list (10k+ rows for seeded accounts) finishes paging in — so the
  // cards never flash "0" while the list loads.
  const [fastCounts, setFastCounts] = useState<Record<DeckState, number> | null>(null);
  const [shown, setShown] = useState(PAGE);

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

      if (user) {
        Promise.all((["red", "orange", "green"] as DeckState[]).map((st) =>
          supabase.from("saved_words").select("id", { count: "exact", head: true })
            .eq("user_id", user.id).eq("language", lang).eq("state", st)
            .then(({ count }) => [st, count ?? 0] as const),
        )).then((pairs) => { if (alive) setFastCounts(Object.fromEntries(pairs) as Record<DeckState, number>); });
      }

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
      // Unpaged, this silently truncated at PostgREST's 1000-row default —
      // easy to hit here specifically, since CEFR-level seeding
      // (seed_known_vocabulary) can pre-populate thousands of green words
      // for a single language in one shot, not just organic saves over time.
      const pageSize = 1000;
      let from = 0;
      const rows: DeckWord[] = [];
      while (true) {
        const { data, error } = await supabase
          .from("saved_words")
          .select("id, word, translation, state, state_changed_at, created_at")
          .eq("user_id", user.id)
          .eq("language", lang)
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) { console.error("Vocabulary fetch failed", error); break; }
        const batch = ((data as any[]) || []).map((w) => ({ ...w, state: coerceDeckState(w.state) })) as DeckWord[];
        rows.push(...batch);
        if (batch.length < pageSize) break;
        from += pageSize;
      }
      if (!alive) return;
      setWords(rows);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, learningLanguage]);

  const counts = useMemo(() => {
    const c: Record<DeckState, number> = { red: 0, orange: 0, green: 0 };
    for (const w of words) c[w.state] = (c[w.state] ?? 0) + 1;
    return loading && fastCounts ? fastCounts : c;
  }, [words, loading, fastCounts]);
  const countsReady = !loading || fastCounts != null;
  const total = counts.red + counts.orange + counts.green;
  useEffect(() => { setShown(PAGE); }, [filter, search]);

  // ⚪ Unassessed = high-frequency words in this language we haven't seen the
  // learner save yet. Never goes negative; falls back to 0 until we know.
  const unassessed = useMemo(() => {
    if (coreTotal == null) return null;
    return Math.max(0, coreTotal - words.length);
  }, [coreTotal, words.length]);

  // Words genuinely *learned* this week — i.e. promoted to green after being
  // saved. CEFR-seeded vocabulary is created green in one shot (created_at ==
  // state_changed_at), and counting it produced the fictional "+700 this week"
  // a brand-new account was shown on day one.
  const learnedThisWeek = useMemo(() => {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return words.filter((w) => {
      if (w.state !== "green" || !w.state_changed_at) return false;
      const changed = new Date(w.state_changed_at).getTime();
      if (changed < since) return false;
      if (w.created_at) {
        const created = new Date(w.created_at).getTime();
        if (Math.abs(changed - created) < 5000) return false; // seeded, not learned
      }
      return true;
    }).length;
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
    <div className="ls-cinema min-h-screen bg-background">
      <PremiumHeader
        title="Your Vocabulary"
        onBack={() => navigate("/discover")}
        icon={<BrandMark variant="pin" size={26} />}
        right={<LevelBadge />}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {learningLanguage && <FrequencyCoverageCard language={learningLanguage} />}

        {/* Three decks: Known · Learning · New, each a filter. */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {DECKS.map((d, i) => {
            const meta = STATE_META[d.key];
            const share = total ? counts[d.key] / total : 0;
            return (
              <motion.div
                key={d.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              >
                <GlassCard
                  as="button"
                  accent={DECK_ACCENT[d.key]}
                  glow={filter === d.key}
                  onClick={() => setFilter(filter === d.key ? "all" : d.key)}
                  className="ls-press w-full p-5 text-left"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full shadow-[0_0_10px_currentColor]", meta.dot)} />
                    <p className="font-semibold text-foreground">{d.title}</p>
                  </div>
                  {countsReady ? (
                    <p className={cn("text-4xl font-black tracking-tight", meta.text)}><CountUp value={counts[d.key]} /></p>
                  ) : (
                    <Skeleton className="h-10 w-28" />
                  )}
                  <p className="text-xs text-muted-foreground mt-1">{d.subtitle}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div className={cn("h-full rounded-full transition-[width] duration-1000", meta.dot)} style={{ width: `${Math.round(share * 100)}%` }} />
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </section>

        {/* Totals */}
        <section className="grid grid-cols-2 gap-4">
          <GlassCard className="p-5">
            <Eyebrow>Total saved</Eyebrow>
            {countsReady ? <p className="text-3xl font-black mt-1"><CountUp value={total} /></p> : <Skeleton className="mt-2 h-8 w-20" />}
          </GlassCard>
          <GlassCard className="p-5" accent="green">
            <Eyebrow>Learned this week</Eyebrow>
            {loading ? <Skeleton className="mt-2 h-8 w-14" /> : (
              <p className="text-3xl font-black mt-1 text-[#34C759]">+<CountUp value={learnedThisWeek} /></p>
            )}
          </GlassCard>
        </section>

        {/* Filter + search */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "red", "orange", "green"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "ls-chip-glass px-3.5 py-1.5 text-xs font-semibold transition",
                  filter === f ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_-4px_hsl(var(--primary))]" : "text-muted-foreground hover:text-foreground",
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
                className="pl-9 rounded-full bg-white/5 border-white/10"
              />
            </div>
            <Button onClick={() => navigate("/flashcards")} className="gap-2 rounded-full">
              <BookOpen className="w-4 h-4" /> Review
            </Button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[74px]" />)}
            </div>
          ) : filtered.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-muted-foreground">
              No words here yet. Tap any word in subtitles to save it.
            </GlassCard>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.slice(0, shown).map((w) => {
                  const meta = STATE_META[w.state];
                  return (
                    <div
                      key={w.id}
                      className="group rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition hover:bg-white/[0.06] hover:border-white/10 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2 h-2 rounded-full shrink-0", meta.dot)} />
                          <p className="font-semibold text-foreground truncate" translate="no">{w.word}</p>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{w.translation}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 rounded-full opacity-70 group-hover:opacity-100"
                        onClick={() => speak(w.word, learningLanguage)}
                        title="Pronounce"
                      >
                        <Volume2 className="w-4 h-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              {filtered.length > shown && (
                <div className="flex justify-center">
                  <Button variant="outline" className="rounded-full" onClick={() => setShown((n) => n + PAGE * 2)}>
                    Show more ({(filtered.length - shown).toLocaleString()} left)
                  </Button>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
