import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GapFillChallenge } from "@/components/GapFillChallenge";
import { ActiveRecallReview } from "@/components/ActiveRecallReview";
import { LinguaScriptCreation } from "@/components/LinguaScriptCreation";
import { RecogniseStep } from "@/components/RecogniseStep";
import { generateLinguaScriptFromWord } from "@/lib/linguascripts";
import { DECK } from "@/lib/deck-colors";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { Loader2, ArrowRight } from "lucide-react";
import { useLineBlast } from "@/hooks/useLineBlast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { nextState, coerceDeckState, type DeckState } from "@/lib/vocab";
import type { RecallOutcome } from "@/lib/activeRecall";

interface Exercise {
  id: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: DeckState;
  /** The saved_words row this exercise was generated from, if any — the
   *  write target for Active Recall's deck promotion. Older rows created
   *  before this column was backfilled can be null. */
  saved_word_id: string | null;
}

/**
 * gap-fill and active-recall now carry `exerciseIndex` because they used to
 * each pick their own word independently — gap-fill hardcoded exercises[0],
 * recall rotated through exercises[stageIndex % length] — so a session could
 * warm up on one word and test memory on a different one entirely. One index
 * per stage is what makes "the same word climbs the ladder" true rather than
 * aspirational.
 */
interface SessionStage {
  type: "recognise" | "gap-fill" | "active-recall" | "linguascript" | "complete";
  exerciseIndex?: number;
}

interface LinguaScriptSessionProps {
  exerciseIds: string[]; // IDs of exercises for this session
  onSessionComplete: (data: { totalXp: number; exercises: string[] }) => void;
}

export function LinguaScriptSession({
  exerciseIds,
  onSessionComplete,
}: LinguaScriptSessionProps) {
  const { user } = useAuth();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageIndex, setStageIndex] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const { learningLanguage, nativeLanguage } = useLanguage() as any;
  // Word meaning per saved word id, plus a pool of other meanings for options.
  const [meanings, setMeanings] = useState<Record<string, string>>({});
  const [meaningPool, setMeaningPool] = useState<string[]>([]);

  /**
   * The blast is for a LinguaScript's sentence turning fully green, never for
   * clearing a stage.
   *
   * Stages are ordinary progress — gap-fill, recall, production — and firing
   * the celebration on each one spent it three times per word on things the
   * learner did not experience as a breakthrough. The breakthrough is the
   * sentence becoming readable end to end.
   */
  const blast = useLineBlast({ language: learningLanguage });

  // Arm every sentence up front, before any stage can change the deck.
  useEffect(() => {
    for (const ex of exercises) blast.armLine(ex.sentence);
  }, [exercises, blast.ready, blast]);

  /** Blast any sentence in this session that just became fully green. */
  const checkSentences = useCallback(() => {
    let fired = false;
    for (const ex of exercises) {
      if (blast.completeLine(ex.sentence)) fired = true;
    }
    return fired;
  }, [exercises, blast]);

  // Load exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const { data, error } = await supabase
          .from("linguascripts")
          .select("*")
          .in("id", exerciseIds);

        if (error) throw error;
        const rows = (data || []) as any[];
        const ids = rows.map((r) => r.saved_word_id).filter(Boolean);
        if (user && learningLanguage) {
          const [own, pool] = await Promise.all([
            ids.length
              ? supabase.from("saved_words").select("id, translation").in("id", ids)
              : Promise.resolve({ data: [] as any[] }),
            supabase
              .from("saved_words")
              .select("translation")
              .eq("user_id", user.id)
              .eq("language", learningLanguage)
              .not("translation", "is", null)
              .limit(60),
          ]);
          const m: Record<string, string> = {};
          for (const r of (own.data || []) as any[]) if (r.translation) m[r.id] = r.translation;
          setMeanings(m);
          setMeaningPool(((pool.data || []) as any[]).map((r) => r.translation).filter(Boolean));
        }
        setExercises(
          rows.map((row) => ({
            ...row,
            word_state: coerceDeckState(row.word_state),
          })) as Exercise[],
        );
      } catch (err) {
        console.error("Error loading exercises:", err);
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [exerciseIds]);

  // Gap-fill then recall, per word, in order — then one production stage
  // covering every word, then complete. See the SessionStage comment above
  // for why the per-word index matters.
  const generateStages = useCallback((): SessionStage[] => {
    if (exercises.length === 0) return [];

    const stages: SessionStage[] = [];
    exercises.forEach((ex, i) => {
      if (ex.saved_word_id && meanings[ex.saved_word_id]) {
        stages.push({ type: "recognise", exerciseIndex: i });
      }
      stages.push({ type: "gap-fill", exerciseIndex: i });
      stages.push({ type: "active-recall", exerciseIndex: i });
    });
    stages.push({ type: "linguascript" });
    stages.push({ type: "complete" });
    return stages;
  }, [exercises, meanings]);

  const stages = generateStages();

  const handleGapFillComplete = useCallback(() => {
    setStageIndex((prev) => prev + 1);
  }, []);

  /**
   * Promote the deck on a clean recall only. An assisted recall still earns
   * XP but holds the word's current position — retrieval with a hint is real
   * work, but it is the unaided recall that is evidence the word is learned.
   * `nextState` is forward-only, so a promotion here can never demote a word
   * that recall alone would demote.
   */
  const handleActiveRecallComplete = useCallback(
    async (
      data: { outcome: RecallOutcome; hintsUsed: number; xpEarned: number },
      exercise: Exercise,
    ) => {
      if (data.xpEarned > 0) setSessionXp((prev) => prev + data.xpEarned);

      if (data.outcome === "clean") {
        const promoted = nextState(exercise.word_state, 0, true);
        if (promoted !== exercise.word_state) {
          setExercises((prev) =>
            prev.map((e) => (e.id === exercise.id ? { ...e, word_state: promoted } : e)),
          );
          blast.markGreen(exercise.target_word);

          if (user && exercise.saved_word_id) {
            await supabase
              .from("saved_words")
              .update({ state: promoted, state_changed_at: new Date().toISOString() } as any)
              .eq("id", exercise.saved_word_id)
              .eq("user_id", user.id);
          }
        }
        // Recall can be what pushes a word green and completes its sentence.
        checkSentences();
      } else {
        blast.breakCombo();
      }

      // linguascript_reviews already has a method_used constraint expecting
      // 'active-recall' rows, and its whole purpose is Phase 2 spaced-
      // repetition data — performance, first-try success — none of which
      // existed anywhere until now. performance is a rough 0-100 proxy for
      // that later use, not a precision score.
      if (user) {
        const performance = data.outcome === "clean" ? 100 : data.outcome === "assisted" ? 50 : 0;
        void supabase.from("linguascript_reviews").insert({
          linguascript_id: exercise.id,
          user_id: user.id,
          method_used: "active-recall",
          performance,
          first_try_correct: data.outcome === "clean" && data.hintsUsed === 0,
          session_id: `session_${Date.now()}`,
        } as any);

        // Real spacing: clean recall climbs the ladder 1→3→7→21→60 days,
        // a hint holds the step, a reveal drops back to tomorrow.
        const INTERVALS = [1, 3, 7, 21, 60];
        const cur = Number((exercise as any).stage ?? 0);
        const next =
          data.outcome === "clean"
            ? Math.min(cur + 1, INTERVALS.length - 1)
            : data.outcome === "assisted"
              ? cur
              : 0;
        const due = new Date(Date.now() + INTERVALS[next] * 86400000);
        void supabase
          .from("linguascripts")
          .update({ stage: next, scheduled_for: due.toISOString(), status: "started" } as any)
          .eq("id", exercise.id)
          .eq("user_id", user.id);

        // Fresh context: once a word is on step 3+ (7 days out), swap its
        // sentence so the next visit meets the word in a new line.
        const meaning = exercise.saved_word_id ? meanings[exercise.saved_word_id] : undefined;
        if (next >= 2 && meaning && learningLanguage) {
          void generateLinguaScriptFromWord({
            word: exercise.target_word,
            translation: meaning,
            interests: [],
            cefLevel: "B1",
            language: learningLanguage,
            wordState: exercise.word_state,
            nativeLanguage: nativeLanguage || "en",
          }).then((fresh) => {
            if (!fresh?.sentence || !fresh.sentence.toLowerCase().includes(exercise.target_word.toLowerCase())) return;
            void supabase
              .from("linguascripts")
              .update({ sentence: fresh.sentence, translation: fresh.translation || exercise.translation } as any)
              .eq("id", exercise.id)
              .eq("user_id", user.id);
          });
        }
      }

      setStageIndex((prev) => prev + 1);
    },
    [blast, checkSentences, user, meanings, learningLanguage, nativeLanguage],
  );

  const handleLinguaScriptComplete = useCallback(
    (data: { sentences: any[]; totalXp: number }) => {
      setSessionXp((prev) => prev + data.totalXp);
      // Production is the last stage, so this is the session's best chance for
      // a sentence to have gone fully green.
      checkSentences();

      // Save performance data
      saveSentenceData(data.sentences);

      // Move to complete
      setStageIndex((prev) => prev + 1);
    },
    [checkSentences]
  );

  const saveSentenceData = async (sentences: any[]) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const reviews = sentences.map((s) => ({
        linguascript_id: exercises.find((e) => e.target_word === s.word)?.id,
        user_id: user.id,
        method_used: "linguascript",
        performance: s.score,
        user_text: s.userText,
        ai_feedback: s.feedback,
        session_id: `session_${Date.now()}`,
      }));

      await supabase.from("linguascript_reviews").insert(reviews);
    } catch (err) {
      console.error("Error saving sentence data:", err);
    }
  };

  const handleSessionComplete = useCallback(() => {
    onSessionComplete({
      totalXp: sessionXp,
      exercises: exerciseIds,
    });
  }, [sessionXp, exerciseIds, onSessionComplete]);

  const handleSkip = useCallback(() => {
    blast.breakCombo();
    setStageIndex((prev) => Math.min(prev + 1, stages.length - 1));
  }, [stages.length, blast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-slate-400">Loading session...</p>
        </div>
      </div>
    );
  }

  if (exercises.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
        <div className="text-center">
          <p className="text-slate-400">No exercises found</p>
        </div>
      </div>
    );
  }

  const currentStage = stages[stageIndex];
  const currentExercise =
    currentStage.exerciseIndex != null ? exercises[currentStage.exerciseIndex] : undefined;
  const wordNumber = currentStage.exerciseIndex != null ? currentStage.exerciseIndex + 1 : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6">
      {/* Session Progress */}
      <div className="container mx-auto max-w-4xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black" style={{ color: DECK.green }}>LinguaScripts</h1>
            <p className="text-sm text-slate-400">
              {stageIndex + 1} of {stages.length - 1} stages
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-emerald-400">{sessionXp} XP</p>
            <p className="text-xs text-slate-400">earned so far</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              background: DECK.green,
              width: `${((stageIndex + 1) / stages.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Stage Content */}
      <div className="container mx-auto max-w-4xl">
        {currentStage.type === "recognise" && currentExercise && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              Word {wordNumber} of {exercises.length} — Listen
            </p>
            <RecogniseStep
              key={currentExercise.id}
              word={currentExercise.target_word}
              meaning={meanings[currentExercise.saved_word_id!]}
              distractors={meaningPool}
              language={learningLanguage}
              onComplete={(ok) => {
                if (ok) setSessionXp((p) => p + 5);
                setStageIndex((p) => p + 1);
              }}
            />
          </div>
        )}

        {currentStage.type === "gap-fill" && currentExercise && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Word {wordNumber} of {exercises.length} — Fill the gap
            </p>
            {/*
              gapIndex and distractors are still the pre-existing bugs: this
              blanks the FIRST word of the sentence rather than the target
              word, and the distractor is a neighbouring exercise's word
              rather than one drawn from the learner's own deck. Both are
              scoped to the gap-fill rebuild (buildGapFill), not this pass —
              the fix here is only that every stage now looks at the SAME
              word, via currentExercise, instead of a hardcoded index.
            */}
            <GapFillChallenge
              words={currentExercise.sentence.split(/\s+/)}
              gapIndex={Math.max(
                0,
                currentExercise.sentence
                  .split(/\s+/)
                  .findIndex((w) =>
                    w.toLowerCase().replace(/[.,!?;:«»"'¿¡]/g, "").includes(currentExercise.target_word.toLowerCase()),
                  ),
              )}
              distractors={[
                exercises[(currentStage.exerciseIndex! + 1) % exercises.length]?.target_word ??
                  "test",
                exercises[(currentStage.exerciseIndex! + 2) % exercises.length]?.target_word ??
                  "test",
                "test",
              ]}
              tier={currentExercise.word_state === "green" ? "orange" : currentExercise.word_state}
              translation={currentExercise.translation}
              onComplete={handleGapFillComplete}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "active-recall" && currentExercise && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Word {wordNumber} of {exercises.length} — Recall
            </p>
            <ActiveRecallReview
              exerciseId={currentExercise.id}
              sentence={currentExercise.sentence}
              targetWord={currentExercise.target_word}
              translation={currentExercise.translation}
              language={learningLanguage}
              onComplete={(data) => handleActiveRecallComplete(data, currentExercise)}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "linguascript" && (
          <div>
            <p className="text-sm text-slate-400 mb-4">Stage 3: Make Sentences (Production)</p>
            <LinguaScriptCreation
              words={exercises.map((e) => e.target_word)}
              onComplete={handleLinguaScriptComplete}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "complete" && (
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
            <div className="mb-6">
              <p className="text-4xl font-black text-amber-400 mb-2">{sessionXp} XP</p>
              <p className="text-slate-400">Session Complete!</p>
            </div>
            <p className="text-slate-300 mb-6">
              Great work! You listened, filled gaps and recalled for {exercises.length} words.
            </p>
            <button
              onClick={handleSessionComplete}
              className="px-6 py-3 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold rounded-lg hover:shadow-lg transition-all"
            >
              <span>Back to Dashboard</span>
              <ArrowRight className="w-4 h-4 ml-2 inline" />
            </button>
          </div>
        )}
      </div>

      {/* The celebration, from the same component the landing demo uses. */}
      <canvas
        ref={blast.canvasRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-40 h-full w-full"
      />
      <LineBlastOverlay
        praise={blast.praise}
        floatXp={blast.floatXp}
        glowKey={blast.glowKey}
        placement="screen"
      />
    </div>
  );
}
