import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GapFillChallenge } from "@/components/GapFillChallenge";
import { ActiveRecallReview } from "@/components/ActiveRecallReview";
import { LinguaScriptCreation } from "@/components/LinguaScriptCreation";
import { DictationStep } from "@/components/DictationStep";
import { RecogniseStep } from "@/components/RecogniseStep";
import { generateLinguaScriptFromWord } from "@/lib/linguascripts";
import { DECK } from "@/lib/deck-colors";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { Loader2, ArrowRight } from "lucide-react";
import { useLineBlast } from "@/hooks/useLineBlast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { coerceDeckState, type DeckState } from "@/lib/vocab";
import type { RecallOutcome } from "@/lib/activeRecall";
import {
  shuffle,
  tokensWithUnit,
  pairHint,
  isCleanSentence,
  loadVocabBand,
  gapDistractors,
  meaningDistractors,
  nextStage,
  dueDate,
  beforeToday,
  INTERVALS,
  type VocabRow,
  type RecallResult,
  cleanToken,
} from "@/lib/lsTeaching";
import { headlineBand, loadFrequencyCoverage } from "@/lib/frequencyCoverage";

const GREEN = DECK.green;

interface Exercise {
  id: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: DeckState;
  saved_word_id: string | null;
  stage?: number | null;
}

type StepType = "recognise" | "dictation" | "gap-fill" | "active-recall";

/**
 * Interleaved rounds instead of massed practice: every word is heard first,
 * then every word is gapped, then every word is recalled. Minutes pass between
 * seeing a word and having to retrieve it — the "desirable difficulty" that
 * makes recall evidence of learning rather than short-term echo. Misses are
 * re-queued at the end of their round (relearning) up to twice.
 */
interface Step {
  type: StepType | "linguascript" | "complete";
  ex?: number;
  retry?: number;
}

interface WordLog {
  recogniseOk?: boolean;
  slip?: boolean;
  gapFirstTry?: boolean;
  recall?: RecallResult;
}

const MAX_RETRIES = 2;

interface LinguaScriptSessionProps {
  exerciseIds: string[];
  onSessionComplete: (data: { totalXp: number; exercises: string[] }) => void;
}

export function LinguaScriptSession({ exerciseIds, onSessionComplete }: LinguaScriptSessionProps) {
  const { user } = useAuth();
  const { learningLanguage, nativeLanguage } = useLanguage() as any;
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [steps, setSteps] = useState<Step[]>([]);
  const [idx, setIdx] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  const [stateChangedAt, setStateChangedAt] = useState<Record<string, string | null>>({});
  const [meaningPool, setMeaningPool] = useState<string[]>([]);
  const [band, setBand] = useState<VocabRow[]>([]);
  const [profile, setProfile] = useState<{ level: string; interests: string[] }>({ level: "a2", interests: [] });
  const [summary, setSummary] = useState<{ toNext: number | null; nextBand: number | null }>({ toNext: null, nextBand: null });
  const logs = useRef<Record<string, WordLog>>({});
  const writes = useRef<PromiseLike<unknown>[]>([]);
  const [finishing, setFinishing] = useState(false);

  const blast = useLineBlast({ language: learningLanguage });

  useEffect(() => {
    for (const ex of exercises) blast.armLine(ex.sentence);
  }, [exercises, blast.ready, blast]);

  const checkSentences = useCallback(() => {
    for (const ex of exercises) blast.completeLine(ex.sentence);
  }, [exercises, blast]);

  // Load exercises + everything the rounds need.
  useEffect(() => {
    const run = async () => {
      try {
        const { data, error } = await supabase.from("linguascripts").select("*").in("id", exerciseIds);
        if (error) throw error;
        const rows = ((data || []) as any[]).map((r) => ({ ...r, word_state: coerceDeckState(r.word_state) })) as Exercise[];
        const ids = rows.map((r) => r.saved_word_id).filter(Boolean) as string[];
        const m: Record<string, string> = {};
        const sc: Record<string, string | null> = {};
        let maxRank = 400;
        if (user && learningLanguage) {
          const [own, pool, lp] = await Promise.all([
            ids.length
              ? supabase.from("saved_words").select("id, translation, state_changed_at, frequency_rank").in("id", ids)
              : Promise.resolve({ data: [] as any[] }),
            supabase
              .from("saved_words")
              .select("translation")
              .eq("user_id", user.id)
              .eq("language", learningLanguage)
              .not("translation", "is", null)
              .limit(80),
            supabase
              .from("language_profiles")
              .select("cefr_level, interests")
              .eq("user_id", user.id)
              .eq("language", learningLanguage)
              .maybeSingle(),
          ]);
          for (const r of (own.data || []) as any[]) {
            if (r.translation) m[r.id] = r.translation;
            sc[r.id] = r.state_changed_at;
            if (r.frequency_rank) maxRank = Math.max(maxRank, r.frequency_rank);
          }
          setMeaningPool(((pool.data || []) as any[]).map((r) => r.translation).filter(Boolean));
          if (lp.data) setProfile({ level: (lp.data as any).cefr_level || "a2", interests: (lp.data as any).interests || [] });
          const vb = await loadVocabBand(learningLanguage, maxRank);
          setBand(vb);
          // Every word gets a meaning so the listening round always runs.
          const missing = rows.filter((r) => !(r.saved_word_id && m[r.saved_word_id]));
          if (missing.length) {
            const { data: byWord } = await supabase
              .from("saved_words")
              .select("word, translation")
              .eq("user_id", user.id)
              .eq("language", learningLanguage)
              .in("word", missing.map((r) => r.target_word));
            const own2 = new Map(((byWord || []) as any[]).map((r) => [cleanToken(r.word), r.translation]));
            for (const r of missing) {
              const t = cleanToken(r.target_word);
              const tr = own2.get(t) || vb.find((v) => cleanToken(v.word) === t)?.translation;
              if (tr) m[`ex:${r.id}`] = tr;
            }
          }
        }
        setMeanings(m);
        setStateChangedAt(sc);
        setExercises(rows);

        // Build interleaved rounds.
        const order = rows.map((_, i) => i);
        const s: Step[] = [
          ...order.filter((i) => m[rows[i].saved_word_id || ""] || m[`ex:${rows[i].id}`]).map((i) => ({ type: "recognise" as const, ex: i })),
          ...shuffle(order).map((i) => ({ type: "dictation" as const, ex: i })),
          ...shuffle(order).map((i) => ({ type: "gap-fill" as const, ex: i })),
          ...shuffle(order).map((i) => ({ type: "active-recall" as const, ex: i })),
          { type: "linguascript" },
          { type: "complete" },
        ];
        setSteps(s);
      } catch (err) {
        console.error("Error loading exercises:", err);
      } finally {
        setLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exerciseIds]);

  const meaningOf = (e: Exercise) => (e.saved_word_id && meanings[e.saved_word_id]) || meanings[`ex:${e.id}`];

  const log = (id: string) => (logs.current[id] ||= {});

  /** Advance; if the item was missed, re-queue it at the end of its round. */
  const advance = useCallback((requeue: boolean) => {
    setSteps((prev) => {
      const cur = prev[idx];
      if (!requeue || !cur || (cur.retry ?? 0) >= MAX_RETRIES) return prev;
      let end = idx + 1;
      while (end < prev.length && prev[end].type === cur.type) end++;
      const next = [...prev];
      next.splice(end, 0, { ...cur, retry: (cur.retry ?? 0) + 1 });
      return next;
    });
    setIdx((p) => p + 1);
  }, [idx]);

  /** Schedule + promote once per word, from its first recall attempt. */
  const commitWord = useCallback(
    (ex: Exercise, recall: RecallResult) => {
      if (!user) return;
      const l = log(ex.id);
      const slipped = l.recogniseOk === false || l.gapFirstTry === false || !!l.slip;
      const next = nextStage(Number(ex.stage ?? 0), recall, slipped);
      writes.current.push(
        supabase
          .from("linguascripts")
          .update({ stage: next, scheduled_for: dueDate(next).toISOString(), status: "started" } as any)
          .eq("id", ex.id)
          .eq("user_id", user.id)
          .then(),
      );
      writes.current.push(
        supabase.from("linguascript_reviews").insert({
          linguascript_id: ex.id,
          user_id: user.id,
          method_used: "active-recall",
          performance: recall === "clean" ? (slipped ? 75 : 100) : recall === "assisted" ? 50 : 0,
          first_try_correct: recall === "clean" && !slipped,
          session_id: `session_${Date.now()}`,
        } as any).then(),
      );

      // Promotion: red→orange on a clean recall; orange→green only when the
      // word was last promoted on an earlier day (remembered across a sleep).
      let promoted: DeckState = ex.word_state;
      if (recall === "clean") {
        if (ex.word_state === "red") promoted = "orange";
        else if (ex.word_state === "orange" && ex.saved_word_id && beforeToday(stateChangedAt[ex.saved_word_id])) promoted = "green";
      }
      if (promoted !== ex.word_state) {
        setExercises((prev) => prev.map((e) => (e.id === ex.id ? { ...e, word_state: promoted } : e)));
        if (promoted === "green") blast.markGreen(ex.target_word);
        if (ex.saved_word_id) {
          writes.current.push(
            supabase
              .from("saved_words")
              .update({ state: promoted, state_changed_at: new Date().toISOString() } as any)
              .eq("id", ex.saved_word_id)
              .eq("user_id", user.id)
              .then(),
          );
        }
      }

      // Fresh, clean sentence at the learner's own level for later visits.
      const meaning = meaningOf(ex);
      const needsNew = next >= 2 || !isCleanSentence(ex.sentence, ex.target_word, learningLanguage);
      if (needsNew && meaning && learningLanguage) {
        void generateLinguaScriptFromWord({
          word: ex.target_word,
          translation: meaning,
          interests: profile.interests,
          cefLevel: profile.level.toUpperCase(),
          language: learningLanguage,
          wordState: promoted,
          nativeLanguage: nativeLanguage || "en",
        }).then((fresh) => {
          if (!fresh?.sentence || !isCleanSentence(fresh.sentence, ex.target_word, learningLanguage)) return;
          void supabase
            .from("linguascripts")
            .update({ sentence: fresh.sentence, translation: fresh.translation || ex.translation } as any)
            .eq("id", ex.id)
            .eq("user_id", user.id);
        });
      }
    },
    [user, stateChangedAt, meanings, learningLanguage, nativeLanguage, profile, blast],
  );

  const handleRecall = useCallback(
    (data: { outcome: RecallOutcome; hintsUsed: number; xpEarned: number }, ex: Exercise, step: Step) => {
      if (data.xpEarned > 0) setSessionXp((p) => p + data.xpEarned);
      const result: RecallResult =
        data.outcome === "clean" ? "clean" : data.outcome === "assisted" ? "assisted" : "failed";
      if (!step.retry) {
        log(ex.id).recall = result;
        commitWord(ex, result);
      }
      if (result === "clean") checkSentences();
      else blast.breakCombo();
      advance(result === "failed");
    },
    [commitWord, checkSentences, blast, advance],
  );

  const saveSentenceData = async (sentences: any[]) => {
    if (!user) return;
    const reviews = sentences
      .map((s) => ({
        linguascript_id: exercises.find((e) => e.target_word === s.word)?.id,
        user_id: user.id,
        method_used: "linguascript",
        performance: s.score,
        user_text: s.userText,
        ai_feedback: s.feedback,
        session_id: `session_${Date.now()}`,
      }))
      .filter((r) => r.linguascript_id);
    if (reviews.length) writes.current.push(supabase.from("linguascript_reviews").insert(reviews as any).then());
  };

  const current = steps[idx];

  // Ladder distance for the end screen.
  useEffect(() => {
    if (current?.type !== "complete" || !learningLanguage) return;
    void Promise.all(writes.current).then(async () => {
      const b = headlineBand(await loadFrequencyCoverage(learningLanguage));
      if (b) setSummary({ toNext: Math.max(0, b.total - b.known), nextBand: b.band });
    });
  }, [current?.type, learningLanguage]);

  const stats = useMemo(() => {
    const vals = Object.values(logs.current);
    const clean = vals.filter((v) => v.recall === "clean").length;
    return { clean, total: exercises.length };
  }, [exercises.length, current?.type]);

  const finish = async () => {
    setFinishing(true);
    await Promise.allSettled(writes.current);
    onSessionComplete({ totalXp: sessionXp, exercises: exerciseIds });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: GREEN }} />
          <p className="text-muted-foreground">Loading session...</p>
        </div>
      </div>
    );
  }

  if (exercises.length === 0 || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">No exercises found</p>
      </div>
    );
  }

  const ex = current.ex != null ? exercises[current.ex] : undefined;
  const roundLabel: Record<string, string> = {
    recognise: "Round 1 · Listen",
    dictation: "Round 2 · Hear & type",
    "gap-fill": "Round 3 · Fill the gap",
    "active-recall": "Round 4 · Recall",
    linguascript: "Round 5 · Say it & use it",
  };

  return (
    <div className="min-h-screen bg-background p-6 text-foreground">
      <div className="container mx-auto mb-8 max-w-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black" style={{ color: GREEN }}>LinguaScripts</h1>
            <p className="text-sm text-muted-foreground">
              {roundLabel[current.type] ?? "Done"}
              {current.retry ? " · one more try" : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black" style={{ color: GREEN }}>{sessionXp} XP</p>
            <p className="text-xs text-muted-foreground">earned so far</p>
          </div>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full transition-all duration-300"
            style={{ background: GREEN, width: `${((idx + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="container mx-auto max-w-2xl">
        {current.type === "recognise" && ex && (
          <RecogniseStep
            key={`${ex.id}-r-${current.retry ?? 0}`}
            word={ex.target_word}
            meaning={meaningOf(ex)!}
            distractors={meaningDistractors(ex.target_word, meaningOf(ex)!, band, meaningPool)}
            language={learningLanguage}
            sentence={isCleanSentence(ex.sentence, ex.target_word, learningLanguage) ? ex.sentence : undefined}
            sentenceTranslation={ex.translation}
            pairHint={pairHint(ex.target_word, learningLanguage)}
            onComplete={(ok) => {
              if (!current.retry) log(ex.id).recogniseOk = ok;
              if (ok) setSessionXp((p) => p + 5);
              advance(!ok);
            }}
          />
        )}

        {current.type === "dictation" && ex && (
          <DictationStep
            key={`${ex.id}-d-${current.retry ?? 0}`}
            word={ex.target_word}
            language={learningLanguage}
            meaning={meaningOf(ex)}
            onComplete={(ok) => {
              if (!current.retry && !ok) log(ex.id).slip = true;
              if (ok) setSessionXp((p) => p + 5);
              advance(!ok);
            }}
          />
        )}

        {current.type === "gap-fill" && ex && (() => {
          const { tokens, gapIndex } = tokensWithUnit(ex.sentence, ex.target_word, learningLanguage);
          const answer = tokens[gapIndex] ?? ex.target_word;
          const distractors = gapDistractors(answer, band, exercises.map((e) => e.target_word));
          return (
            <GapFillChallenge
              key={`${ex.id}-g-${current.retry ?? 0}`}
              words={tokens}
              gapIndex={gapIndex}
              distractors={distractors}
              tier={ex.word_state === "green" ? "orange" : ex.word_state}
              translation={ex.translation}
              onComplete={(firstTry) => {
                if (!current.retry) log(ex.id).gapFirstTry = firstTry;
                advance(!firstTry);
              }}
              onSkip={() => {
                if (!current.retry) log(ex.id).gapFirstTry = false;
                blast.breakCombo();
                advance(true);
              }}
            />
          );
        })()}

        {current.type === "active-recall" && ex && (() => {
          const { unit } = tokensWithUnit(ex.sentence, ex.target_word, learningLanguage);
          return (
            <ActiveRecallReview
              key={`${ex.id}-a-${current.retry ?? 0}`}
              exerciseId={ex.id}
              sentence={ex.sentence}
              targetWord={unit || ex.target_word}
              translation={ex.translation}
              language={learningLanguage}
              onComplete={(data) => handleRecall(data, ex, current)}
              onSkip={() => handleRecall({ outcome: "revealed" as RecallOutcome, hintsUsed: 0, xpEarned: 0 }, ex, current)}
            />
          );
        })()}

        {current.type === "linguascript" && (
          <LinguaScriptCreation
            items={exercises.map((e) => ({
              word: e.target_word,
              example: e.sentence,
              exampleTranslation: e.translation,
            }))}
            onComplete={(data) => {
              setSessionXp((p) => p + data.totalXp);
              checkSentences();
              void saveSentenceData(data.sentences);
              setIdx((p) => p + 1);
            }}
            onSkip={() => setIdx((p) => p + 1)}
          />
        )}

        {current.type === "complete" && (
          <div className="rounded-2xl border p-8 text-center" style={{ borderColor: `${GREEN}55`, background: `${GREEN}14` }}>
            <p className="mb-2 text-4xl font-black" style={{ color: GREEN }}>{sessionXp} XP</p>
            <p className="text-muted-foreground">Session complete</p>
            <p className="mt-6 text-lg font-bold">
              {stats.clean} / {stats.total} words recalled without help
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Words you nailed come back in {INTERVALS[1]}–{INTERVALS[2]} days. Words you missed come back tomorrow.
            </p>
            {summary.nextBand != null && summary.toNext != null && (
              <p className="mt-4 text-sm">
                {summary.toNext === 0 ? (
                  <>You know every word in the top <b>{summary.nextBand.toLocaleString()}</b>.</>
                ) : (
                  <>
                    <b style={{ color: GREEN }}>{summary.toNext}</b> more word{summary.toNext !== 1 ? "s" : ""} to reach the top{" "}
                    <b>{summary.nextBand.toLocaleString()}</b>
                  </>
                )}
              </p>
            )}
            <button
              onClick={finish}
              disabled={finishing}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold text-background disabled:opacity-60"
              style={{ background: GREEN }}
            >
              {finishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Back to LinguaScripts <ArrowRight className="h-4 w-4" /></>}
            </button>
          </div>
        )}
      </div>

      <canvas ref={blast.canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 h-full w-full" />
      <LineBlastOverlay praise={blast.praise} floatXp={blast.floatXp} glowKey={blast.glowKey} placement="screen" />
    </div>
  );
}
