import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GapFillChallenge } from "@/components/GapFillChallenge";
import { TileSentenceBuilder } from "@/components/TileSentenceBuilder";
import { ActiveRecallReview } from "@/components/ActiveRecallReview";
import { LinguaScriptCreation } from "@/components/LinguaScriptCreation";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { useLineBlast } from "@/hooks/useLineBlast";
import { useLanguage } from "@/contexts/LanguageContext";
import { nextState, type DeckState } from "@/lib/vocab";
import { buildExerciseOptions } from "@/lib/linguascripts";

interface Exercise {
  id: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: "red" | "orange" | "green";
}

interface SessionStage {
  type: "gap-fill" | "tile-builder" | "active-recall" | "linguascript" | "complete";
  exerciseIds?: string[];
  words?: string[];
}

interface LinguaScriptSessionProps {
  exerciseIds: string[]; // IDs of exercises for this session
  onSessionComplete: (data: { totalXp: number; exercises: string[] }) => void;
  /** Lets a host screen offer a way out mid-session. Hidden when omitted. */
  onClose?: () => void;
}

export function LinguaScriptSession({
  exerciseIds,
  onSessionComplete,
  onClose,
}: LinguaScriptSessionProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<SessionStage>({ type: "gap-fill", exerciseIds });
  const [stageIndex, setStageIndex] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const { learningLanguage } = useLanguage();

  /**
   * Every word runs the same four-stage spec — gap-fill, tile builder,
   * active recall, then production — before the next word starts its own
   * four. Interleaving stages across different words (gap-fill on word A,
   * recall on word B) was the bug this fixes: STAGES_PER_WORD is the one
   * place that ordering is defined, so the stage list and "which word is
   * this" lookup can never drift apart again.
   */
  const STAGES_PER_WORD = 4;
  const currentExercise = exercises[Math.floor(stageIndex / STAGES_PER_WORD)];

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

  /**
   * The gap-fill blank, computed from the real target word instead of
   * hardcoded to word 0 — and distractors drawn from the session's other
   * real words instead of a literal "test" placeholder.
   */
  const gapFillData = useMemo(() => {
    const ex = currentExercise;
    if (!ex) return null;
    const distractorPool = exercises
      .filter((e) => e.id !== ex.id)
      .map((e) => e.target_word)
      .filter((w, i, arr) => w && arr.indexOf(w) === i);
    const { gapPosition, gapOptions } = buildExerciseOptions(ex.sentence, ex.target_word, distractorPool);
    return {
      words: ex.sentence.split(/\s+/),
      gapIndex: gapPosition,
      distractors: gapOptions.distractors,
    };
  }, [currentExercise, exercises]);

  /**
   * Persist a clean (correct, no-hint) recall as forward SRS progress —
   * the same red→orange→green rule FlashcardReview already applies, just
   * reached from a word instead of an existing saved_words row.
   */
  const promoteWordState = useCallback(
    async (targetWord: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: existing, error: fetchError } = await supabase
        .from("saved_words")
        .select("id, state, times_correct")
        .eq("user_id", user.id)
        .eq("language", learningLanguage)
        .eq("word", targetWord)
        .maybeSingle();

      if (fetchError) {
        console.error("[ActiveRecall] failed to load saved_words row", fetchError);
        return;
      }

      const prevState = (existing?.state as DeckState | undefined) ?? "red";
      const prevTimes = existing?.times_correct ?? 0;
      const newState = nextState(prevState, prevTimes, true);
      const newTimes = prevTimes + 1;

      try {
        if (existing) {
          const patch: Record<string, unknown> = { state: newState, times_correct: newTimes };
          if (newState !== prevState) patch.state_changed_at = new Date().toISOString();
          const { error } = await supabase
            .from("saved_words")
            .update(patch as any)
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("saved_words").insert({
            user_id: user.id,
            word: targetWord,
            language: learningLanguage,
            state: newState,
            times_correct: newTimes,
            state_changed_at: new Date().toISOString(),
          } as any);
          if (error) throw error;
        }
      } catch (error) {
        console.error("[ActiveRecall] failed to persist deck transition", error);
      }
    },
    [learningLanguage]
  );

  // Load exercises
  useEffect(() => {
    const loadExercises = async () => {
      try {
        const { data, error } = await supabase
          .from("linguascripts")
          .select("*")
          .in("id", exerciseIds);

        if (error) throw error;
        setExercises((data || []) as unknown as Exercise[]);
      } catch (err) {
        console.error("Error loading exercises:", err);
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [exerciseIds]);

  // Generate session stages: gap-fill, active-recall, linguascript for each
  // word in turn, so all three ever run on the word they were assembled
  // for — never on whichever word a stale index happened to land on.
  const generateStages = useCallback((): SessionStage[] => {
    if (exercises.length === 0) return [];

    const stages: SessionStage[] = [];

    for (const ex of exercises) {
      stages.push({ type: "gap-fill", exerciseIds: [ex.id] });
      stages.push({ type: "tile-builder", exerciseIds: [ex.id] });
      stages.push({ type: "active-recall", exerciseIds: [ex.id] });
      stages.push({ type: "linguascript", exerciseIds: [ex.id], words: [ex.target_word] });
    }

    stages.push({ type: "complete" });

    return stages;
  }, [exercises]);

  const stages = generateStages();

  const handleGapFillComplete = useCallback(() => {
    setStageIndex((prev) => prev + 1);
  }, []);

  const handleTileBuilderComplete = useCallback(
    (data: { correct: boolean; xpEarned: number }) => {
      const exercise = currentExercise;
      if (data.correct && data.xpEarned > 0) {
        setSessionXp((prev) => prev + data.xpEarned);
        if (exercise) blast.markGreen(exercise.target_word);
        checkSentences();
      } else {
        blast.breakCombo();
      }
      setStageIndex((prev) => prev + 1);
    },
    [blast, checkSentences, currentExercise]
  );

  const handleActiveRecallComplete = useCallback(
    (data: { correct: boolean; xpEarned: number }) => {
      const exercise = currentExercise;

      if (data.xpEarned > 0) {
        setSessionXp((prev) => prev + data.xpEarned);
        if (exercise) {
          // Clean recall is forward SRS progress, not just session XP.
          void promoteWordState(exercise.target_word);
          blast.markGreen(exercise.target_word);
        }
        // Recall can be what pushes a word green and completes its sentence.
        checkSentences();
      } else {
        blast.breakCombo();
      }
      setStageIndex((prev) => prev + 1);
    },
    [blast, checkSentences, currentExercise, promoteWordState]
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
  const wordNumber = Math.min(Math.floor(stageIndex / STAGES_PER_WORD) + 1, exercises.length);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6">
      {/* Session Progress */}
      <div className="container mx-auto max-w-4xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {onClose && (
              <button
                onClick={onClose}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                aria-label="Exit session"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-black text-amber-400">LinguaScript Session</h1>
              <p className="text-sm text-slate-400">
                {stageIndex + 1} of {stages.length - 1} stages
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-emerald-400">{sessionXp} XP</p>
            <p className="text-xs text-slate-400">earned so far</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{
              width: `${((stageIndex + 1) / stages.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Stage Content */}
      <div className="container mx-auto max-w-4xl">
        {currentStage.type === "gap-fill" && gapFillData && currentExercise && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Word {wordNumber} of {exercises.length} · Gap-Fill (Warm-up)
            </p>
            <GapFillChallenge
              words={gapFillData.words}
              gapIndex={gapFillData.gapIndex}
              distractors={gapFillData.distractors}
              tier={currentExercise.word_state === "green" ? "orange" : currentExercise.word_state}
              translation={currentExercise.translation}
              onComplete={handleGapFillComplete}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "tile-builder" && currentExercise && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Word {wordNumber} of {exercises.length} · Tile Builder
            </p>
            <TileSentenceBuilder
              sentence={currentExercise.sentence}
              translation={currentExercise.translation}
              language={learningLanguage}
              onComplete={handleTileBuilderComplete}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "active-recall" && currentExercise && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Word {wordNumber} of {exercises.length} · Active Recall (Memory)
            </p>
            <ActiveRecallReview
              exerciseId={currentExercise.id}
              sentence={currentExercise.sentence}
              targetWord={currentExercise.target_word}
              translation={currentExercise.translation}
              onComplete={handleActiveRecallComplete}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "linguascript" && currentExercise && (
          <div>
            <p className="text-sm text-slate-400 mb-4">
              Word {wordNumber} of {exercises.length} · Make a Sentence (Production)
            </p>
            <LinguaScriptCreation
              words={[currentExercise.target_word]}
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
              Great work! You completed all 4 methods for {exercises.length} words.
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
