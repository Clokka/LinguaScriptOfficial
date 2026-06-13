import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Volume2, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { DeckState, STATE_META } from "@/lib/vocab";
import { getGuestWords } from "@/lib/guestWords";
import { cn } from "@/lib/utils";

interface DeckWord {
  id: string;
  word: string;
  translation: string;
  state: DeckState;
  state_changed_at?: string | null;
}

const DECKS: { key: DeckState; title: string; subtitle: string }[] = [
  { key: "red",    title: "Red Deck",    subtitle: "New — just saved" },
  { key: "orange", title: "Orange Deck", subtitle: "Learning" },
  { key: "green",  title: "Green Deck",  subtitle: "Learned" },
];

export default function Vocabulary() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { speak, learningLanguage } = useLanguage();

  const [words, setWords] = useState<DeckWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | DeckState>("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        const guest = getGuestWords()
          .filter((g) => g.language === (learningLanguage || "fr"))
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
        .eq("language", learningLanguage || "fr")
        .order("created_at", { ascending: false });
      if (!alive) return;
      setWords(((data as any[]) || []) as DeckWord[]);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [user, learningLanguage]);

  const counts = useMemo(() => {
    const c = { red: 0, orange: 0, green: 0 };
    for (const w of words) c[w.state] = (c[w.state] ?? 0) + 1;
    return c;
  }, [words]);

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
          <Button variant="ghost" size="icon" onClick={() => navigate("/browse")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Your Decks</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {/* Deck counts */}
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
                    className="rounded-xl border border-border/60 p-4 bg-card/50 transition hover:bg-card flex items-start justify-between gap-2"
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
                      onClick={() => speak(w.word)}
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
    </div>
  );
}
