// Speed Run (/speed-run): five tiny courses that teach the most frequent words
// first — 2 words ≈ 1 in 10 words you hear, 100 words ≈ half. Rules and
// numbers live in src/lib/speedRun.ts. Words go into saved_words (red) and are
// practised with the normal FlashcardReview, so the ONE review ladder
// (packages/core/src/review.ts) applies from the very first word.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, Lock, Target, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageLoading } from "@/components/PageLoading";
import { FlashcardReview } from "@/components/FlashcardReview";
import type { ComponentProps } from "react";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { ExportDeckButtons } from "@/components/ExportDeckButtons";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useXp } from "@/contexts/XpContext";
import { LANGUAGES } from "@/lib/languages";
import { getNativeLanguage, overlayNative } from "@/lib/nativeGloss";
import { normalizeToken, type DeckState } from "@/lib/vocab";
import { FIRST_REVIEW_MINUTES, REVIEW_LADDER_DAYS, DECK_COLOURS } from "@linguascript/core/review";
import { DEFAULT_WORD_GOAL } from "@/lib/progressStats";
import { COURSES, courseHref, isAffiliate } from "@/lib/landingCourses";
import type { LearnLang } from "@/lib/landingSegment";
import { track } from "@/lib/analytics";
import {
  SPEED_RUN, ROUND_SIZE, wordsIn, smartDeadline, courseStart, sentencesFor, type SpeedRunCourse,
} from "@/lib/speedRun";

interface CoreWord { rank: number; word: string; translation: string; cefr_level: string | null }
interface Saved { id: string; word: string; state: DeckState; times_correct: number; translation: string; pronunciation: string; ipa: string }
type ReviewCard = ComponentProps<typeof FlashcardReview>["cards"][number];
type Step = "meet" | "practice" | "celebrate" | "how" | "next";

const LAST_RANK = SPEED_RUN[SPEED_RUN.length - 1].to;
const doneKey = (lang: string, n: number) => `ls.speedRun.done.${lang}.${n}`;
const seenDone = (lang: string, n: number) => { try { return !!localStorage.getItem(doneKey(lang, n)); } catch { return false; } };
const markDone = (lang: string, n: number) => { try { localStorage.setItem(doneKey(lang, n), "1"); } catch { /* fine */ } };

export default function SpeedRun() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { level } = useXp();
  const { learningLanguage } = useLanguage();
  const language = (learningLanguage || "fr").toLowerCase();
  const langName = LANGUAGES.find((l) => l.code === language)?.label ?? language.toUpperCase();
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<CoreWord[]>([]);
  const [saved, setSaved] = useState<Map<string, Saved>>(new Map());
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_WORD_GOAL);
  const [learningGoal, setLearningGoal] = useState("");
  const [step, setStep] = useState<Step | null>(null);
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [busy, setBusy] = useState(false);

  const loadSaved = useCallback(async (list: CoreWord[]) => {
    const map = new Map<string, Saved>();
    if (!user || list.length === 0) return map;
    const { data } = await supabase
      .from("saved_words")
      .select("id, word, state, times_correct, translation, pronunciation, ipa")
      .eq("user_id", user.id)
      .eq("language", language)
      .in("word", list.map((w) => w.word));
    for (const r of (data as Saved[] | null) || []) map.set(normalizeToken(r.word), r);
    return map;
  }, [user, language]);

  useEffect(() => {
    let off = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("core_vocabulary")
        .select("rank, word, translation, cefr_level")
        .eq("language", language)
        .order("rank")
        .range(0, LAST_RANK - 1);
      const list = await overlayNative((data as CoreWord[]) || [], language, await getNativeLanguage(user?.id));
      const map = await loadSaved(list);
      if (user) {
        const { data: p } = await supabase.from("profiles").select("daily_word_goal, learning_goal").eq("user_id", user.id).maybeSingle();
        const prof = p as { daily_word_goal?: number | null; learning_goal?: string | null } | null;
        if (prof?.daily_word_goal) setDailyGoal(prof.daily_word_goal);
        if (prof?.learning_goal) setLearningGoal(prof.learning_goal);
      }
      if (off) return;
      setWords(list);
      setSaved(map);
      setLoading(false);
    })();
    return () => { off = true; };
  }, [language, user, loadSaved]);

  const stateOf = useCallback((w: CoreWord): DeckState => saved.get(normalizeToken(w.word))?.state ?? "red", [saved]);
  const wordsOf = useCallback((c: SpeedRunCourse) => words.filter((w) => w.rank >= c.from && w.rank <= c.to), [words]);
  // A course is finished once every word has been learned at least once
  // (orange or green). Reviews keep going on the normal ladder after that.
  const learnedIn = useCallback((c: SpeedRunCourse) => wordsOf(c).filter((w) => stateOf(w) !== "red").length, [wordsOf, stateOf]);
  const isDone = useCallback((c: SpeedRunCourse) => wordsOf(c).length > 0 && learnedIn(c) >= wordsOf(c).length, [wordsOf, learnedIn]);

  const unlocked = useMemo(() => SPEED_RUN.find((c) => !isDone(c)) ?? SPEED_RUN[SPEED_RUN.length - 1], [isDone]);
  const asked = Number(params.get("course"));
  const course = SPEED_RUN.find((c) => c.n === asked && c.n <= unlocked.n) ?? unlocked;
  const allDone = SPEED_RUN.every(isDone);
  const round = wordsOf(course).filter((w) => stateOf(w) === "red").slice(0, ROUND_SIZE);

  const startPractice = async () => {
    if (!user) { navigate("/auth"); return; }
    if (round.length === 0) { setStep("celebrate"); return; }
    setBusy(true);
    track("speed_run_lesson_started", { course: course.n, language, words: round.length });
    const missing = round.filter((w) => !saved.has(normalizeToken(w.word)));
    if (missing.length) {
      await supabase.from("saved_words").upsert(
        missing.map((w) => ({
          user_id: user.id, word: w.word, translation: w.translation,
          pronunciation: "", ipa: "", context: sentencesFor(language, w.word)[0]?.[0] ?? "", language, state: "red",
          frequency_rank: w.rank, frequency_level: w.cefr_level,
        })) as never,
        { onConflict: "user_id,word,language", ignoreDuplicates: true },
      );
    }
    const map = await loadSaved(words);
    setSaved(map);
    setCards(round.flatMap((w): ReviewCard[] => {
      const s = map.get(normalizeToken(w.word));
      if (!s) return [];
      return [{
        id: s.id, word: w.word, translation: s.translation || w.translation,
        pronunciation: s.pronunciation, ipa: s.ipa, context: sentencesFor(language, w.word)[0]?.[0] ?? "",
        language, state: s.state ?? "red", times_correct: s.times_correct ?? 0,
      }];
    }));
    setStep("practice");
    setBusy(false);
  };

  const finishPractice = async () => {
    const map = await loadSaved(words);
    setSaved(map);
    setCards([]);
    const left = wordsOf(course).filter((w) => (map.get(normalizeToken(w.word))?.state ?? "red") === "red");
    if (left.length === 0 && !seenDone(language, course.n)) {
      markDone(language, course.n);
      track("speed_run_course_completed", { course: course.n, language, pct: course.pct });
      setStep("celebrate");
    } else {
      setStep(null);
    }
  };

  if (loading) return <PageLoading />;

  if (step === "practice" && cards.length > 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <FlashcardReview cards={cards} onClose={finishPractice} />
      </div>
    );
  }

  const back = () => (step ? setStep(null) : navigate("/flashcards"));

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={back} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold text-foreground">Speed Run · {langName}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
        {words.length === 0 ? (
          <p className="rounded-2xl border border-border p-5 text-muted-foreground">
            We don't have a frequency list for {langName} yet. Try French, Spanish, German or Italian.
          </p>
        ) : step === "meet" ? (
          <MeetStep language={language} round={round} course={course} busy={busy} onGo={startPractice} />
        ) : step === "celebrate" ? (
          <Celebrate course={course} langName={langName} level={level} onNext={() => setStep(course.n === 1 ? "how" : "next")} />
        ) : step === "how" ? (
          <HowItWorks onNext={() => setStep("next")} />
        ) : step === "next" ? (
          <NextUp
            course={course}
            language={language}
            langName={langName}
            exportCards={words.filter((w) => w.rank <= course.to).map((w) => ({ word: w.word, meaning: w.translation }))}
            onContinue={() => { setStep(null); setParams({}); }}
          />
        ) : (
          <>
            <SmartGoal course={course} langName={langName} dailyGoal={dailyGoal} learningGoal={learningGoal}
              learned={learnedIn(course)} total={wordsOf(course).length} language={language} />

            <ol className="space-y-2">
              {SPEED_RUN.map((c) => {
                const done = isDone(c);
                const locked = c.n > unlocked.n;
                const current = c.n === course.n;
                return (
                  <li key={c.n}>
                    <button
                      disabled={locked}
                      onClick={() => setParams({ course: String(c.n) })}
                      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${current ? "border-primary bg-primary/10" : "border-border"} ${locked ? "cursor-not-allowed opacity-50" : "hover:border-primary/50"}`}
                    >
                      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black ${done ? "bg-emerald-500 text-white" : "bg-muted text-foreground"}`}>
                        {done ? <Check className="h-5 w-5" /> : `${c.pct}%`}
                      </span>
                      <span className="flex-1">
                        <span className="block text-xs font-semibold uppercase tracking-widest text-muted-foreground">Course {c.n}</span>
                        <span className="block font-bold text-foreground">{c.title}</span>
                        <span className="block text-sm text-muted-foreground">
                          {locked ? "Finish the course above to unlock" : `${learnedIn(c)} / ${wordsOf(c).length} words learned`}
                        </span>
                      </span>
                      {locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  </li>
                );
              })}
            </ol>

            {allDone ? (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                <p className="font-bold text-foreground">Speed Run complete. Half of every sentence is yours.</p>
                <p className="mt-1 text-sm text-muted-foreground">The next words are in the Top 150, 200… decks. Keep reviewing your gold words.</p>
                <Button className="mt-4" onClick={() => navigate("/flashcards/common?band=150")}>Go to the next 50 words</Button>
              </div>
            ) : (
              <Button size="lg" className="w-full gap-2" onClick={() => (user ? setStep("meet") : navigate("/auth"))}>
                <BookOpen className="h-5 w-5" />
                {round.length > 0 ? `Start: ${round.length} new word${round.length === 1 ? "" : "s"}` : "See your win"}
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Numbers from Zipf's law. <a href="/frequent-words" className="underline">How we count</a>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function SmartGoal({ course, langName, dailyGoal, learningGoal, learned, total, language }: {
  course: SpeedRunCourse; langName: string; dailyGoal: number; learningGoal: string; learned: number; total: number; language: string;
}) {
  const deadline = smartDeadline(course, dailyGoal, courseStart(language, course.n));
  const date = deadline.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
  return (
    <section className="rounded-2xl border border-border bg-card/40 p-5">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        <Target className="h-4 w-4" /> Your goal
      </p>
      <p className="mt-2 text-xl font-bold text-foreground">
        Learn {total} {langName} word{total === 1 ? "" : "s"} by {date}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{course.win}</p>
      <Progress value={total ? (learned / total) * 100 : 0} className="mt-4 h-2" />
      <p className="mt-2 text-xs text-muted-foreground">
        {learned} / {total} learned · {dailyGoal} new words a day (your daily goal)
        {learningGoal ? <> · for: <span className="text-foreground">{learningGoal}</span></> : null}
      </p>
    </section>
  );
}

function MeetStep({ language, round, course, busy, onGo }: {
  language: string; round: CoreWord[]; course: SpeedRunCourse; busy: boolean; onGo: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Course {course.n} · meet your words</p>
        <h2 className="mt-1 text-2xl font-black text-foreground">
          {course.n === 1 ? "These 2 words are about 1 in every 10 words you'll hear" : "Your next words, most common first"}
        </h2>
      </div>
      <ul className="space-y-3">
        {round.map((w) => {
          const lines = sentencesFor(language, w.word);
          return (
            <li key={w.rank} className="rounded-2xl border border-border p-4">
              <div className="flex items-baseline gap-3">
                <span className="text-2xl font-black" style={{ color: DECK_COLOURS.red.hex }} translate="no" lang={language}>{w.word}</span>
                <span className="text-muted-foreground">{w.translation}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">#{w.rank}</span>
              </div>
              {lines.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {lines.map(([target, gloss]) => (
                    <li key={target} className="flex flex-wrap gap-x-2">
                      <span className="font-semibold text-foreground" translate="no" lang={language}>{target}</span>
                      {gloss && <span className="text-muted-foreground">— {gloss}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-muted-foreground">
        Say each one out loud. Then practise: get a card right and it goes <b style={{ color: DECK_COLOURS.orange.hex }}>orange</b>, right again and it goes <b style={{ color: DECK_COLOURS.green.hex }}>green</b>.
      </p>
      <Button size="lg" className="w-full" onClick={onGo} disabled={busy}>Practise now</Button>
    </section>
  );
}

const TIERS: ChameleonTier[] = ["red", "orange", "green"];

function Celebrate({ course, langName, level, onNext }: { course: SpeedRunCourse; langName: string; level: number; onNext: () => void }) {
  const [tier, setTier] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setTier(1), 700);
    const t2 = setTimeout(() => setTier(2), 1500);
    const t3 = setTimeout(() => {
      // canvas-confetti only loads here, never in the first-load bundle.
      import("canvas-confetti").then(({ default: confetti }) => confetti({ particleCount: 160 + course.n * 30, spread: 90, origin: { y: 0.6 } })).catch(() => {});
    }, 1500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [course.n]);
  return (
    <section className="flex flex-col items-center text-center">
      <ChameleonMascot tier={TIERS[tier]} party={tier === 2} className="w-56" />
      <p className="mt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Course {course.n} complete</p>
      <p className="mt-2 text-6xl font-black tabular-nums" style={{ color: DECK_COLOURS.green.hex }}>~{course.pct}%</p>
      <h2 className="mt-2 text-2xl font-black text-foreground">of the {langName} you hear is now familiar</h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        {course.win} {course.n <= 2 && "They're small words, but they're everywhere. You'll spot them in your very first video."}
      </p>
      <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-bold text-primary">
        <Sparkles className="h-4 w-4" /> Level {level}
      </p>
      <Button size="lg" className="mt-6 w-full" onClick={onNext}>Next</Button>
    </section>
  );
}

function HowItWorks({ onNext }: { onNext: () => void }) {
  const ladder = [`${FIRST_REVIEW_MINUTES} min`, ...REVIEW_LADDER_DAYS.map((d) => `${d} day${d === 1 ? "" : "s"}`)];
  const rows: { colour: keyof typeof DECK_COLOURS; name: string; text: string }[] = [
    { colour: "red", name: "Red", text: "New. You've just met it." },
    { colour: "orange", name: "Orange", text: "Learning. You got it right once." },
    { colour: "green", name: "Green", text: "Known. Right twice in a row." },
    { colour: "gold", name: "Gold", text: "Time to check you still remember. Review it and it goes back to green." },
  ];
  return (
    <section className="space-y-5">
      <h2 className="text-2xl font-black text-foreground">How LinguaScript keeps words in your head</h2>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.name} className="flex items-center gap-3 rounded-xl border border-border p-3">
            <span className="h-4 w-4 shrink-0 rounded-full" style={{ background: DECK_COLOURS[r.colour].hex }} />
            <span className="font-bold text-foreground">{r.name}</span>
            <span className="text-sm text-muted-foreground">{r.text}</span>
          </li>
        ))}
      </ul>
      <div>
        <p className="text-sm text-muted-foreground">Each green word turns gold again after:</p>
        <p className="mt-2 flex flex-wrap gap-2">
          {ladder.map((s) => (
            <span key={s} className="rounded-full px-3 py-1 text-sm font-bold" style={{ background: `${DECK_COLOURS.gold.hex}22`, color: DECK_COLOURS.gold.deep }}>{s}</span>
          ))}
          <span className="rounded-full px-3 py-1 text-sm text-muted-foreground">then ×1.5 forever</span>
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          This is <b>spaced repetition</b>. Each check comes just before you'd forget, so it takes a few seconds a day.
          Your first gold check is in {FIRST_REVIEW_MINUTES} minutes. Come back for it!
        </p>
      </div>
      <Button size="lg" className="w-full" onClick={onNext}>Next</Button>
    </section>
  );
}

function NextUp({ course, language, langName, exportCards, onContinue }: {
  course: SpeedRunCourse; language: string; langName: string; exportCards: { word: string; meaning: string }[]; onContinue: () => void;
}) {
  const recs = COURSES[language as LearnLang] ?? [];
  const next = SPEED_RUN.find((c) => c.n === course.n + 1);
  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-foreground">Pair LinguaScript with a real course</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          LinguaScript pumps in vocabulary. A course teaches grammar, listening and speaking step by step. Doing both is the fastest way.
        </p>
      </div>
      {recs.length > 0 ? (
        <ul className="space-y-2">
          {recs.map((c) => (
            <li key={c.url}>
              <a
                href={courseHref(c)}
                target="_blank"
                rel={isAffiliate(c) ? "sponsored noopener noreferrer" : "noopener noreferrer"}
                onClick={() => track("partner_course_clicked", { course: c.name, language, affiliate: isAffiliate(c) })}
                className="flex items-center gap-3 rounded-2xl border border-border p-4 hover:border-primary/50"
              >
                <span className="flex-1">
                  <span className="block font-bold text-foreground">{c.name}</span>
                  <span className="block text-sm text-muted-foreground">{c.by} · {c.note}</span>
                  {isAffiliate(c) && <span className="block text-xs text-muted-foreground">Affiliate link: we may earn a commission, at no cost to you.</span>}
                </span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">We're still choosing a course we trust for {langName}.</p>
      )}

      <div className="rounded-2xl border border-border p-4">
        <p className="mb-3 font-bold text-foreground">Already use Anki or Quizlet?</p>
        <ExportDeckButtons cards={exportCards} deckName={`LinguaScript ${langName} top ${course.to}`} />
      </div>

      <Button size="lg" className="w-full" onClick={onContinue}>
        {next ? `Next: course ${next.n} (${next.pct}%)` : "Back to Speed Run"}
      </Button>
    </section>
  );
}
