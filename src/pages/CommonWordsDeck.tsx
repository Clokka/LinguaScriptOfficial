// "Most common words" deck — the frequency list, in order, as flashcards.
// Words the learner doesn't know yet are added to saved_words (red) when they
// start studying, so reviews flow through the normal SRS.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/lib/languages";
import { loadFrequencyCoverage, headlineBand } from "@/lib/frequencyCoverage";
import { normalizeToken, type DeckState } from "@/lib/vocab";

interface CoreWord { rank: number; word: string; translation: string; cefr_level: string | null }
interface Saved { id: string; word: string; state: DeckState; times_correct: number; translation: string; pronunciation: string; ipa: string }

const BATCH = 10;
const DOT: Record<string, string> = { red: "bg-destructive", orange: "bg-accent", green: "bg-emerald-500" };

export default function CommonWordsDeck() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const language = (learningLanguage || "fr").toLowerCase();
  const langName = LANGUAGES.find((l) => l.code === language)?.label ?? language.toUpperCase();

  const [band, setBand] = useState(50);
  const [words, setWords] = useState<CoreWord[]>([]);
  const [saved, setSaved] = useState<Map<string, Saved>>(new Map());
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [reviewCards, setReviewCards] = useState<any[]>([]);

  const loadSaved = useCallback(async (list: CoreWord[]) => {
    const map = new Map<string, Saved>();
    if (!user || list.length === 0) return map;
    const { data } = await supabase
      .from("saved_words")
      .select("id, word, state, times_correct, translation, pronunciation, ipa")
      .eq("user_id", user.id)
      .eq("language", language)
      .in("word", list.map((w) => w.word));
    for (const r of (data as any[]) || []) map.set(normalizeToken(r.word), r);
    return map;
  }, [user, language]);

  const load = useCallback(async () => {
    setLoading(true);
    const bands = await loadFrequencyCoverage(language);
    const b = headlineBand(bands)?.band || 50;
    setBand(b);
    const { data } = await supabase
      .from("core_vocabulary")
      .select("rank, word, translation, cefr_level")
      .eq("language", language)
      .order("rank")
      .limit(b);
    const list = (data as CoreWord[]) || [];
    setWords(list);
    setSaved(await loadSaved(list));
    setLoading(false);
  }, [language, loadSaved]);

  useEffect(() => { load(); }, [load]);

  const stateOf = (w: CoreWord): DeckState => saved.get(normalizeToken(w.word))?.state ?? "red";
  const known = words.filter((w) => stateOf(w) === "green").length;
  const toLearn = words.filter((w) => stateOf(w) !== "green");

  const start = async () => {
    if (!user) { navigate("/auth"); return; }
    const next = toLearn.slice(0, BATCH);
    if (next.length === 0) return;
    setStarting(true);
    const missing = next.filter((w) => !saved.has(normalizeToken(w.word)));
    if (missing.length) {
      await supabase.from("saved_words").upsert(
        missing.map((w) => ({
          user_id: user.id, word: w.word, translation: w.translation,
          pronunciation: "", ipa: "", context: "", language, state: "red",
          frequency_rank: w.rank, frequency_level: w.cefr_level,
        })) as any,
        { onConflict: "user_id,word,language", ignoreDuplicates: true },
      );
    }
    const map = await loadSaved(words);
    setSaved(map);
    setReviewCards(next.flatMap((w) => {
      const s = map.get(normalizeToken(w.word));
      if (!s) return [];
      return [{
        id: s.id, word: w.word, translation: s.translation || w.translation,
        pronunciation: s.pronunciation, ipa: s.ipa, context: "", language,
        state: s.state ?? "red", times_correct: s.times_correct ?? 0,
      }];
    }));
    setStarting(false);
  };

  if (reviewCards.length > 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <FlashcardReview cards={reviewCards} onClose={() => { setReviewCards([]); load(); }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/flashcards")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">Most common words</h1>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
          <section className="rounded-2xl border border-border bg-card/40 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Top {band.toLocaleString()} {langName} words
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {known} <span className="text-muted-foreground">/ {words.length} known</span>
            </p>
            <Progress value={words.length ? (known / words.length) * 100 : 0} className="mt-4 h-1.5" />
            <Button size="lg" className="mt-5 w-full gap-2" onClick={start} disabled={starting || toLearn.length === 0}>
              {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
              {toLearn.length === 0 ? "All known — nice!" : `Study the next ${Math.min(BATCH, toLearn.length)}`}
            </Button>
          </section>

          <ol className="rounded-2xl border border-border divide-y divide-border">
            {words.map((w) => (
              <li key={w.rank} className="flex items-center gap-3 px-4 py-2.5">
                <span className="w-8 text-xs tabular-nums text-muted-foreground">{w.rank}</span>
                <span className={`h-2 w-2 rounded-full ${DOT[stateOf(w)]}`} />
                <span className="font-semibold text-foreground">{w.word}</span>
                <span className="ml-auto text-sm text-muted-foreground truncate">{w.translation}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
