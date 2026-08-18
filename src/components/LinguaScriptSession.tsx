import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GapFillChallenge } from "@/components/GapFillChallenge";
import { ActiveRecallReview } from "@/components/ActiveRecallReview";
import { LinguaScriptCreation } from "@/components/LinguaScriptCreation";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { Loader2, ArrowRight } from "lucide-react";
import { useLineBlast } from "@/hooks/useLineBlast";
import { useLanguage } from "@/contexts/LanguageContext";

interface Exercise {
  id: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: "red" | "orange" | "green";
}

interface SessionStage {
  type: "gap-fill" | "active-recall" | "linguascript" | "complete";
  exerciseIds?: string[];
  words?: string[];
}

interface LinguaScriptSessionProps {
  exerciseIds: string[]; // IDs of exercises for this session
  onSessionComplete: (data: { totalXp: number; exercises: string[] }) => void;
}

export function LinguaScriptSession({
  exerciseIds,
  onSessionComplete,
}: LinguaScriptSessionProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<SessionStage>({ type: "gap-fill", exerciseIds });
  const [stageIndex, setStageIndex] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const { learningLanguage } = useLanguage();

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
        setExercises((data || []) as unknown as Exercise[]);
      } catch (err) {
        console.error("Error loading exercises:", err);
      } finally {
        setLoading(false);
      }
    };

    loadExercises();
  }, [exerciseIds]);

  // Generate session stages
  const generateStages = useCallback((): SessionStage[] => {
    if (exercises.length === 0) return [];

    const stages: SessionStage[] = [];
    const words = exercises.map((e) => e.target_word);

    // Stage 1: Gap-Fill (warm-up, easy)
    stages.push({
      type: "gap-fill",
      exerciseIds: exerciseIds,
    });

    // Stage 2: Active Recall (hard, pure memory)
    stages.push({
      type: "active-recall",
      exerciseIds: exerciseIds,
    });

    // Stage 3: LinguaScript Creation (production, hardest)
    stages.push({
      type: "linguascript",
      words: words,
    });

    // Stage 4: Complete
    stages.push({
      type: "complete",
    });

    return stages;
  }, [exercises, exerciseIds]);

  const stages = generateStages();

  const handleGapFillComplete = useCallback(() => {
    setStageIndex((prev) => prev + 1);
  }, []);

  const handleActiveRecallComplete = useCallback(
    (data: { correct: boolean; xpEarned: number }) => {
      if (data.xpEarned > 0) {
        setSessionXp((prev) => prev + data.xpEarned);
        // Recall can be what pushes a word green and completes its sentence.
        checkSentences();
      } else {
        blast.breakCombo();
      }
      setStageIndex((prev) => prev + 1);
    },
    [blast, checkSentences]
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 p-6">
      {/* Session Progress */}
      <div className="container mx-auto max-w-4xl mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black text-amber-400">LinguaScript Session</h1>
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
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{
              width: `${((stageIndex + 1) / stages.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Stage Content */}
      <div className="container mx-auto max-w-4xl">
        {currentStage.type === "gap-fill" && (
          <div>
            <p className="text-sm text-slate-400 mb-4">Stage 1: Gap-Fill (Warm-up)</p>
            <GapFillChallenge
              words={exercises[0].sentence.split(/\s+/)}
              gapIndex={0} // Simplified for now
              distractors={[
                exercises[1]?.target_word || "test",
                exercises[2]?.target_word || "test",
                "test",
              ]}
              tier={exercises[0].word_state === "green" ? "orange" : exercises[0].word_state}
              translation={exercises[0].translation}
              onComplete={handleGapFillComplete}
              onSkip={handleSkip}
            />
          </div>
        )}

        {currentStage.type === "active-recall" && (
          <div>
            <p className="text-sm text-slate-400 mb-4">Stage 2: Active Recall (Memory)</p>
            <ActiveRecallReview
              exerciseId={exerciseIds[stageIndex % exerciseIds.length]}
              sentence={exercises[stageIndex % exercises.length].sentence}
              targetWord={exercises[stageIndex % exercises.length].target_word}
              translation={exercises[stageIndex % exercises.length].translation}
              onComplete={handleActiveRecallComplete}
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
              Great work! You completed all 3 methods for {exercises.length} words.
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
