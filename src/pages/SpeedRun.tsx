// Speed Run (/speed-run): five tiny courses that teach the most frequent words
// first. Course k = the top words that make up k × 10% of film/TV speech,
// MEASURED per language (src/lib/speedRun.ts). A lesson runs on a dark,
// motion-graphics Stage: meet the words → verb card → word roots → build
// sentences → flashcards → chameleon celebration → how gold works → an
// optional course alongside + Save to Anki/Quizlet.
// Words go into saved_words (red) and are practised with the normal
// FlashcardReview, so the ONE review ladder (packages/core/src/review.ts)
// applies from the very first word.
import { useCallback, useEffect, useMemo, useState, type ComponentProps } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, Lock, Play, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageLoading } from "@/components/PageLoading";
import { FlashcardReview } from "@/components/FlashcardReview";
import { Stage } from "@/components/speedrun/Stage";
import { SentenceBuilder } from "@/components/speedrun/SentenceBuilder";
import { Celebrate, HowItWorks, MeetStep, NextUp, RootsStep, VerbStep } from "@/components/speedrun/LessonSteps";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useXp } from "@/contexts/XpContext";
import { LANGUAGES } from "@/lib/languages";
import { getNativeLanguage, overlayNative } from "@/lib/nativeGloss";
import { normalizeToken, type DeckState } from "@/lib/vocab";
import { DECK_COLOURS } from "@linguascript/core/review";
import { DEFAULT_WORD_GOAL } from "@/lib/progressStats";
import { track } from "@/lib/analytics";
import {
  LESSONS, ROOTS, ROUND_SIZE, courseStart, smartDeadline, speedRunCutShort, speedRunFor, tokensOf,
  type SpeedRunCourse,
} from "@/lib/speedRun";

interface CoreWord { rank: number; word: string; translation: string; cefr_level: string | null }
interface Saved { id: string; word: string; state: DeckState; times_correct: number; translation: string; pronunciation: string; ipa: string }
type ReviewCard = ComponentProps<typeof FlashcardReview>["cards"][number];
type Step = "meet" | "verb" | "roots" | "build" | "practice" | "celebrate" | "how" | "next";

const TINT: Record<Step, string> = {
  meet: DECK_COLOURS.red.hex, verb: DECK_COLOURS.red.hex, roots: "#A78BFA", build: DECK_COLOURS.orange.hex,
  practice: DECK_COLOURS.orange.hex, celebrate: DECK_COLOURS.green.hex, how: DECK_COLOURS.gold.hex, next: DECK_COLOURS.green.hex,
};

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
  const courses = useMemo(() => speedRunFor(language), [language]);
  const lastRank = courses[courses.length - 1]?.to ?? 0;
  const [params, setParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<CoreWord[]>([]);
  const [saved, setSaved] = useState<Map<string, Saved>>(new Map());
  const [native, setNative] = useState("en");
  const [dailyGoal, setDailyGoal] = useState(DEFAULT_WORD_GOAL);
  const [learningGoal, setLearningGoal] = useState("");
  const [flow, setFlow] = useState<Step[]>([]);
  const [step, setStep] = useState<Step | null>(null);
  const [cards, setCards] = useState<ReviewCard[]>([]);

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
      const nat = await getNativeLanguage(user?.id);
      let list: CoreWord[] = [];
      if (lastRank > 0) {
        const { data } = await supabase
          .from("core_vocabulary")
          .select("rank, word, translation, cefr_level")
          .eq("language", language)
          .order("rank")
          .range(0, lastRank - 1);
        list = await overlayNative((data as CoreWord[]) || [], language, nat);
      }
      const map = await loadSaved(list);
      if (user) {
        const { data: p } = await supabase.from("profiles").select("daily_word_goal, learning_goal").eq("user_id", user.id).maybeSingle();
        const prof = p as { daily_word_goal?: number | null; learning_goal?: string | null } | null;
        if (prof?.daily_word_goal) setDailyGoal(prof.daily_word_goal);
        if (prof?.learning_goal) setLearningGoal(prof.learning_goal);
      }
      if (off) return;
      setNative(nat);
      setWords(list);
      setSaved(map);
      setLoading(false);
    })();
    return () => { off = true; };
  }, [language, user, loadSaved, lastRank]);

  const stateIn = (map: Map<string, Saved>, w: CoreWord): DeckState => map.get(normalizeToken(w.word))?.state ?? "red";
  const wordsOf = useCallback((c: SpeedRunCourse) => words.filter((w) => w.rank >= c.from && w.rank <= c.to), [words]);
  // A course is finished once every word has been learned at least once
  // (orange or green). Reviews keep going on the normal ladder after that.
  const learnedIn = useCallback((c: SpeedRunCourse, map = saved) => wordsOf(c).filter((w) => stateIn(map, w) !== "red").length, [wordsOf, saved]);
  const isDone = useCallback((c: SpeedRunCourse, map = saved) => wordsOf(c).length > 0 && learnedIn(c, map) >= wordsOf(c).length, [wordsOf, learnedIn, saved]);

  const unlocked = useMemo(() => courses.find((c) => !isDone(c)) ?? courses[courses.length - 1], [courses, isDone]);
  const asked = Number(params.get("course"));
  const course = courses.find((c) => c.n === asked && unlocked && c.n <= unlocked.n) ?? unlocked;
  const allDone = courses.length > 0 && courses.every((c) => isDone(c));
  const round = course ? wordsOf(course).filter((w) => stateIn(saved, w) === "red").slice(0, ROUND_SIZE) : [];
  const lesson = course ? LESSONS[language]?.[course.n] : undefined;
  const roots = ROOTS[language];
  const known = useMemo(() => new Set(words.filter((w) => course && w.rank <= course.to).map((w) => w.word.toLowerCase())), [words, course]);
  const contextFor = (word: string) => lesson?.build.find((b) => tokensOf(b.tiles.join(" ")).includes(word.toLowerCase()))?.tiles.join(" ") ?? "";

  const go = (steps: Step[]) => { setFlow(steps); setStep(steps[0]); };
  const celebrateFlow = (c: SpeedRunCourse) => go(["celebrate", ...(c.n === 1 ? (["how"] as Step[]) : []), "next"]);

  const startLesson = () => {
    if (!user) { navigate("/auth"); return; }
    if (!course) return;
    if (round.length === 0) { markDone(language, course.n); celebrateFlow(course); return; }
    track("speed_run_lesson_started", { course: course.n, language, words: round.length });
    go([
      "meet",
      ...(lesson?.verb ? (["verb"] as Step[]) : []),
      ...(roots && roots.course === course.n && native === "en" ? (["roots"] as Step[]) : []),
      ...(lesson?.build.length ? (["build"] as Step[]) : []),
      "practice",
    ]);
  };

  const startPractice = async () => {
    if (!user || !course) return;
    const missing = round.filter((w) => !saved.has(normalizeToken(w.word)));
    if (missing.length) {
      await supabase.from("saved_words").upsert(
        missing.map((w) => ({
          user_id: user.id, word: w.word, translation: w.translation,
          pronunciation: "", ipa: "", context: contextFor(w.word), language, state: "red",
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
        pronunciation: s.pronunciation, ipa: s.ipa, context: contextFor(w.word),
        language, state: s.state ?? "red", times_correct: s.times_correct ?? 0,
      }];
    }));
    setStep("practice");
  };

  const next = () => {
    const at = step ? flow.indexOf(step) : -1;
    const n = flow[at + 1];
    if (!n) { setStep(null); setFlow([]); return; }
    if (n === "practice") { void startPractice(); return; }
    setStep(n);
  };

  const finishPractice = async () => {
    const map = await loadSaved(words);
    setSaved(map);
    setCards([]);
    if (course && isDone(course, map) && !seenDone(language, course.n)) {
      markDone(language, course.n);
      track("speed_run_course_completed", { course: course.n, language, pct: course.pct });
      celebrateFlow(course);
    } else {
      setStep(null);
      setFlow([]);
    }
  };

  const close = () => { setStep(null); setFlow([]); };

  if (loading) return <PageLoading />;

  if (step === "practice" && cards.length > 0) {
    return (
      <div className="min-h-screen bg-background px-4 py-8">
        <FlashcardReview cards={cards} onClose={finishPractice} />
      </div>
    );
  }

  if (step && step !== "practice" && course) {
    const nextCourse = courses.find((c) => c.n === course.n + 1);
    const prevPct = courses.find((c) => c.n === course.n - 1)?.pct ?? 0;
    const skippable = step === "verb" || step === "roots" || step === "build";
    return (
      <Stage tint={TINT[step]} step={step} steps={flow} onClose={close} onSkip={skippable ? next : undefined}>
        {step === "meet" && <MeetStep words={round} course={course} lang={language} tint={TINT.meet} onNext={next} />}
        {step === "verb" && lesson?.verb && <VerbStep verb={lesson.verb} lang={language} tint={TINT.verb} onNext={next} />}
        {step === "roots" && roots && <RootsStep tip={roots} lang={language} tint={TINT.roots} onNext={next} />}
        {step === "build" && lesson && (
          <SentenceBuilder items={lesson.build} known={known} lang={language} showCognates={native === "en"} tint={TINT.build} onDone={next} />
        )}
        {step === "celebrate" && <Celebrate course={course} prevPct={prevPct} langName={langName} level={level} onNext={next} />}
        {step === "how" && <HowItWorks sampleWord={wordsOf(course)[0]?.word ?? "?"} lang={language} tint={TINT.how} onNext={next} />}
        {step === "next" && (
          <NextUp
            course={course}
            nextCourse={nextCourse}
            language={language}
            langName={langName}
            exportCards={words.filter((w) => w.rank <= course.to).map((w) => ({ word: w.word, meaning: w.translation }))}
            tint={TINT.next}
            onContinue={() => { close(); setParams({}); }}
          />
        )}
      </Stage>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="flex items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/flashcards")} aria-label="Back"><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-bold text-foreground">⚡ Speed Run · {langName}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:px-6">
        {!course || words.length === 0 ? (
          <p className="rounded-2xl border border-border p-5 text-muted-foreground">
            We don't have a frequency list for {langName} yet. Try French, Spanish, German or Italian.
          </p>
        ) : (
          <>
            <SmartGoal course={course} langName={langName} dailyGoal={dailyGoal} learningGoal={learningGoal}
              learned={learnedIn(course)} total={wordsOf(course).length} language={language} />

            <motion.ol
              className="relative space-y-3"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
            >
              <span aria-hidden className="absolute bottom-6 left-[38px] top-6 w-0.5 bg-border" />
              {courses.map((c) => {
                const done = isDone(c);
                const locked = !!unlocked && c.n > unlocked.n;
                const current = c.n === course.n;
                return (
                  <motion.li key={c.n} variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } }}>
                    <button
                      disabled={locked}
                      onClick={() => setParams({ course: String(c.n) })}
                      className={`relative flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${current ? "border-primary bg-primary/10" : "border-border bg-background"} ${locked ? "cursor-not-allowed opacity-50" : "hover:border-primary/50"}`}
                    >
                      <span
                        className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-black"
                        style={done ? { background: DECK_COLOURS.green.hex, color: "white" } : current ? { background: DECK_COLOURS.red.hex, color: "white" } : undefined}
                      >
                        {done ? <Check className="h-5 w-5" /> : <span className={current ? "" : "text-foreground"}>{c.pct}%</span>}
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
                  </motion.li>
                );
              })}
            </motion.ol>

            {speedRunCutShort(language) && (
              <p className="text-sm text-muted-foreground">
                {langName} sticks small parts onto words, so each exact word form is rarer. Speed Run stops at {courses[courses.length - 1].pct}% here, and the Top-50 decks take you further.
              </p>
            )}

            {allDone ? (
              <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
                <p className="font-bold text-foreground">Speed Run complete! About {courses[courses.length - 1].pct}% of the words you hear are yours.</p>
                <p className="mt-1 text-sm text-muted-foreground">Keep going with the next 50 words, and keep reviewing your gold words.</p>
                <Button className="mt-4" onClick={() => navigate(`/flashcards/common?band=${Math.ceil((lastRank + 1) / 50) * 50}`)}>Go to the next words</Button>
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={startLesson}
                className="flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-bold text-white shadow-lg"
                style={{ background: DECK_COLOURS.red.hex, boxShadow: `0 12px 40px -12px ${DECK_COLOURS.red.hex}` }}
              >
                <Play className="h-5 w-5 fill-current" />
                {round.length > 0 ? `Start course ${course.n}: ${round.length} new word${round.length === 1 ? "" : "s"}` : "See your win"}
              </motion.button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Measured in real film & TV subtitles. <a href="/frequent-words" className="underline">Why frequent words first?</a>
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
