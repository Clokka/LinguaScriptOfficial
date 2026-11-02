import { getNativeLanguage, overlayNative } from "@/lib/nativeGloss";
// "Most common words" deck — the frequency list, in order, as flashcards.
// Words the learner doesn't know yet are added to saved_words (red) when they
// start studying, so reviews flow through the normal SRS.
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/lib/languages";
import { loadFrequencyCoverage, headlineBand, unlockedBand, doneCount, type CoverageBand } from "@/lib/frequencyCoverage";
import { FrequencyCoverageCard } from "@/components/FrequencyCoverageCard";
import { Check, Lock } from "lucide-react";
import { normalizeToken, type DeckState } from "@/lib/vocab";
import { topUpDailyNew, DAILY_NEW } from "@/lib/focusDeck";
import { GlassCard, CountUp, PremiumHeader, Eyebrow, Skeleton, ProgressRing } from "@/components/premium";

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

  const [params, setParams] = useSearchParams();
  const [band, setBand] = useState(50);
  const [bands, setBands] = useState<CoverageBand[]>([]);
  const [words, setWords] = useState<CoreWord[]>([]);
  const [saved, setSaved] = useState<Map<string, Saved>>(new Map());
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [reviewCards, setReviewCards] = useState<any[]>([]);
  const [addedToday, setAddedToday] = useState(0);
  const [dueNow, setDueNow] = useState(0);
  const [justDone, setJustDone] = useState<number | null>(null);

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
    if (user) {
      const r = await topUpDailyNew(user.id, language).catch(() => null);
      setAddedToday(r?.addedToday ?? 0);
      const { count } = await supabase.from("saved_words").select("id", { count: "exact", head: true })
        .eq("user_id", user.id).eq("language", language).lte("next_review", new Date().toISOString().slice(0, 10));
      setDueNow(count ?? 0);
    }
    const bs = await loadFrequencyCoverage(language);
    setBands(bs);
    const asked = Number(params.get("band"));
    const unlocked = unlockedBand(bs);
    // One-line "deck complete" note the first time a new deck unlocks.
    const doneKey = `ls.focusBand.${language}`;
    const prevBand = Number(localStorage.getItem(doneKey) || 0);
    if (bs.length) {
      if (prevBand && unlocked > prevBand) setJustDone(unlocked - 50);
      localStorage.setItem(doneKey, String(unlocked));
    }
    // Decks unlock in order: finish Top 50 to open Top 100, and so on.
    const b = asked >= 50 && asked <= unlocked && asked % 50 === 0 ? asked : unlocked;
    setBand(b);
    // Each deck is the next 50 words by frequency, stacked on the decks below it.
    const { data } = await supabase
      .from("core_vocabulary")
      .select("rank, word, translation, cefr_level")
      .eq("language", language)
      .order("rank")
      .range(b - 50, b - 1);
    const list = await overlayNative((data as CoreWord[]) || [], language, await getNativeLanguage(user?.id));
    setWords(list);
    setSaved(await loadSaved(list));
    setLoading(false);
  }, [language, loadSaved, user, params]);

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
    <div className="ls-aurora min-h-screen bg-background">
      <PremiumHeader title="Most common words" onBack={() => navigate("/flashcards")} />

      {loading ? (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-56 rounded-3xl" />
          <Skeleton className="h-16 rounded-2xl" />
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {Array.from({ length: 15 }, (_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          <FrequencyCoverageCard language={language} studyTo="/flashcards" />
          {justDone && (
            <GlassCard accent="green" glow className="px-4 py-3 text-sm font-semibold text-emerald-400">
              🎉 Top {justDone.toLocaleString()} complete. Top {(justDone + 50).toLocaleString()} unlocked.
            </GlassCard>
          )}
          {user && (
            <GlassCard className="flex items-center justify-between gap-3 px-5 py-4">
              <p className="text-sm text-muted-foreground">
                Today: <span className="font-semibold text-foreground">{Math.min(addedToday, DAILY_NEW)} new words</span>
                <span className="mx-1.5 opacity-40">·</span>
                <span className="font-semibold text-amber-300">{dueNow.toLocaleString()}</span> to review
              </p>
              <Button size="sm" className="rounded-full px-5 shadow-[0_0_24px_-6px_hsl(var(--primary))]" onClick={() => navigate("/flashcards")}>Review</Button>
            </GlassCard>
          )}

          {/* Current deck */}
          <GlassCard accent="green" glow className="p-6">
            <div className="flex items-center gap-5">
              <ProgressRing value={words.length ? known / words.length : 0} size={84} stroke={7}>
                <span className="text-sm font-bold text-foreground tabular-nums">{words.length ? Math.round((known / words.length) * 100) : 0}%</span>
              </ProgressRing>
              <div className="min-w-0">
                <Eyebrow>Top {band.toLocaleString()} {langName} words · {band - 49}–{band}</Eyebrow>
                <p className="mt-1 text-3xl font-black text-foreground">
                  <CountUp value={known} /> <span className="text-muted-foreground font-bold">/ {words.length} known</span>
                </p>
              </div>
            </div>
            <Button size="lg" className="ls-shine mt-6 w-full gap-2 rounded-full text-base font-bold shadow-[0_10px_40px_-12px_hsl(var(--primary))]" onClick={start} disabled={starting || toLearn.length === 0}>
              {starting ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
              {toLearn.length === 0 ? "All known — nice!" : `Study the next ${Math.min(BATCH, toLearn.length)}`}
            </Button>
          </GlassCard>

          <section>
            <Eyebrow className="mb-3">Decks</Eyebrow>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {Array.from({ length: 60 }, (_, i) => (i + 1) * 50).map((b) => {
                const cur = bands.find((x) => x.band === b);
                const prev = bands.find((x) => x.band === b - 50);
                const sliceKnown = Math.max(0, doneCount(cur) - doneCount(prev));
                const sliceTotal = Math.max(0, (cur?.total ?? b) - (prev?.total ?? b - 50));
                const done = sliceTotal > 0 && sliceKnown >= sliceTotal;
                const next = unlockedBand(bands) === b;
                const locked = b > unlockedBand(bands);
                const pct = sliceTotal ? Math.min(100, (sliceKnown / sliceTotal) * 100) : 0;
                return (
                  <button
                    key={b}
                    disabled={locked}
                    aria-label={locked ? `Top ${b} locked — finish the deck before it` : `Top ${b}`}
                    onClick={() => setParams({ band: String(b) })}
                    className={`relative overflow-hidden rounded-2xl border px-3 py-2.5 text-left transition ${
                      b === band
                        ? "border-primary/70 bg-primary/15 shadow-[0_0_24px_-8px_hsl(var(--primary))]"
                        : next ? "border-primary/40 bg-white/[0.03]" : done ? "border-emerald-500/20 bg-emerald-500/[0.05]" : "border-white/[0.07] bg-white/[0.02]"
                    } ${locked ? "opacity-40 cursor-not-allowed" : "hover:border-primary/50"}`}
                  >
                    <span className="flex items-center gap-1 text-xs font-bold text-foreground">
                      Top {b.toLocaleString()} {done && <Check className="w-3 h-3 text-emerald-400" />}{locked && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{sliceKnown}/{sliceTotal || 50}</span>
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/5">
                      <span className="block h-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <ol className="ls-glass overflow-hidden divide-y divide-white/[0.06]">
            {words.map((w, i) => {
              const st = stateOf(w);
              return (
                <li key={w.rank} className="flex items-center gap-3 px-5 py-3 transition hover:bg-white/[0.03]">
                  <span className="w-10 text-xs tabular-nums text-muted-foreground">{band - 50 + i + 1}</span>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[st]} ${st === "green" ? "shadow-[0_0_8px_#34C759]" : ""}`} />
                  <span className="font-semibold text-foreground" translate="no">{w.word}</span>
                  <span className="ml-auto text-sm text-muted-foreground truncate">{w.translation}</span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}
