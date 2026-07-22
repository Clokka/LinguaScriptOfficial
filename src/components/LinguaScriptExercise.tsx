import { useState, useEffect } from "react";
import { useContext } from "react";
import { useComboTracker } from "@/hooks/useComboTracker";
import { PetContext } from "@/contexts/PetContext";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import confetti from "canvas-confetti";

type ExerciseMode = "gap-fill" | "mcq" | "speaking";

interface LinguaScriptExerciseProps {
  targetWord?: string;
  language: string;
  interests?: string[];
  mode?: ExerciseMode;
  onComplete?: (script: any) => void;
}

export function LinguaScriptExercise({
  targetWord = "bonjour",
  language,
  interests = [],
  mode = "gap-fill",
  onComplete,
}: LinguaScriptExerciseProps) {
  const [exercise, setExercise] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  const { combo, recordCorrect, recordIncorrect } = useComboTracker();

  useEffect(() => {
    loadExercise();
  }, [targetWord, language]);

  async function loadExercise() {
    try {
      setLoading(true);
      setError(null);

      // Fetch exercise from database
      const { data, error: fetchError } = await supabase
        .from("linguascripts")
        .select("*")
        .eq("language", language)
        .eq("target_word", targetWord)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== "PGRST116") {
        throw fetchError;
      }

      if (!data) {
        // No exercise found, create a temporary one with sample data
        setExercise({
          id: `temp-${targetWord}`,
          target_word: targetWord,
          sentence: `______ - Learning ${targetWord}`,
          translation: `Learn ${targetWord}`,
          gap_options: { correct: targetWord, distractors: ["option1", "option2", "option3"] },
          mcq_options: { correct: 0, options: [targetWord, "option1", "option2", "option3"] },
        });
      } else {
        setExercise(data);
      }
    } catch (err) {
      console.error("Failed to load exercise:", err);
      setError(err instanceof Error ? err.message : "Failed to load exercise");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmitGapFill() {
    const isCorrect =
      userAnswer.toLowerCase().trim() ===
      exercise.gap_options.correct.toLowerCase();
    const baseXp = isCorrect ? 15 : 5;
    const xpWithCombo = Math.floor(baseXp * (1 + combo * 0.1));

    setCorrect(isCorrect);
    setAnswered(true);
    setShowFeedback(true);
    setXpAwarded(xpWithCombo);

    if (isCorrect) {
      recordCorrect();
      confetti({
        particleCount: Math.min(40 + combo * 30, 170),
        spread: 60,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#fbbf24", "#fcd34d", "#34d399", "#6ee7b7", "#f4f7f5"],
      });
    } else {
      recordIncorrect();
    }

    setTimeout(async () => {
      // Update database
      if (exercise.id && !exercise.id.startsWith("temp-")) {
        await supabase
          .from("linguascripts")
          .update({
            status: isCorrect ? "completed" : "started",
            correct: isCorrect,
            gap_answer: userAnswer,
            completed_at: isCorrect ? new Date().toISOString() : null,
            xp_earned: xpWithCombo,
            combo_multiplier: combo,
          })
          .eq("id", exercise.id);
      }

      onComplete?.({
        ...exercise,
        xp_earned: xpWithCombo,
        combo_multiplier: combo,
        status: isCorrect ? "completed" : "started",
      });
    }, 800);
  }

  function handleSubmitMCQ() {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === exercise.mcq_options.correct;
    const baseXp = isCorrect ? 15 : 5;
    const xpWithCombo = Math.floor(baseXp * (1 + combo * 0.1));

    setCorrect(isCorrect);
    setAnswered(true);
    setShowFeedback(true);
    setXpAwarded(xpWithCombo);

    if (isCorrect) {
      recordCorrect();
      confetti({
        particleCount: Math.min(40 + combo * 30, 170),
        spread: 60,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#fbbf24", "#fcd34d", "#34d399", "#6ee7b7", "#f4f7f5"],
      });
    } else {
      recordIncorrect();
    }

    setTimeout(async () => {
      // Update database
      if (exercise.id && !exercise.id.startsWith("temp-")) {
        await supabase
          .from("linguascripts")
          .update({
            status: isCorrect ? "completed" : "started",
            correct: isCorrect,
            mcq_answer: selectedOption,
            completed_at: isCorrect ? new Date().toISOString() : null,
            xp_earned: xpWithCombo,
            combo_multiplier: combo,
          })
          .eq("id", exercise.id);
      }

      onComplete?.({
        ...exercise,
        xp_earned: xpWithCombo,
        combo_multiplier: combo,
        status: isCorrect ? "completed" : "started",
      });
    }, 800);
  }

  function handleReset() {
    setUserAnswer("");
    setSelectedOption(null);
    setAnswered(false);
    setCorrect(false);
    setShowFeedback(false);
    setXpAwarded(0);
  }

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          <div className="h-40 bg-slate-700 rounded mt-6"></div>
        </div>
      </div>
    );
  }

  if (error || !exercise) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-red-500/30 rounded-2xl p-8 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="font-bold text-red-400 mb-2">Error Loading Exercise</h3>
            <p className="text-sm text-slate-400 mb-4">{error || "Exercise not found"}</p>
            <p className="text-xs text-slate-500">
              Make sure you have exercises in your database. Go back and create some first.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-block px-3 py-1 bg-amber-500/20 rounded-lg mb-4">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            {mode === "gap-fill" ? "Gap-Fill Exercise" : "Multiple Choice"}
          </p>
        </div>
        <h2 className="text-2xl font-black mb-2">
          Learn: <span className="text-amber-400">{exercise.target_word}</span>
        </h2>
        <p className="text-sm text-slate-400">{exercise.translation}</p>
      </div>

      {/* Exercise Content */}
      <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
        {mode === "gap-fill" ? (
          <>
            {/* Gap-Fill Mode */}
            <p className="text-lg text-slate-300 mb-6 leading-relaxed">
              {exercise.sentence}
            </p>
            <Input
              placeholder="Type the missing word..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              disabled={answered}
              className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 disabled:opacity-50"
              onKeyPress={(e) => e.key === "Enter" && !answered && handleSubmitGapFill()}
            />
          </>
        ) : (
          <>
            {/* MCQ Mode */}
            <p className="text-lg text-slate-300 mb-6">{exercise.sentence}</p>
            <div className="space-y-3">
              {exercise.mcq_options.options.map((option: string, idx: number) => (
                <button
                  key={idx}
                  onClick={() => !answered && setSelectedOption(idx)}
                  disabled={answered}
                  className={`w-full p-4 text-left rounded-lg border-2 transition-all ${
                    selectedOption === idx
                      ? "border-amber-400 bg-amber-500/10"
                      : "border-slate-600 bg-slate-700/50 hover:border-slate-500"
                  } ${answered ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                        selectedOption === idx
                          ? "border-amber-400 bg-amber-400"
                          : "border-slate-500"
                      }`}
                    >
                      {selectedOption === idx && (
                        <span className="text-slate-900 font-bold">✓</span>
                      )}
                    </div>
                    <span className="text-white font-medium">{option}</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Feedback */}
      {showFeedback && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            correct
              ? "bg-emerald-500/20 border border-emerald-500/40"
              : "bg-red-500/20 border border-red-500/40"
          }`}
        >
          <p className={`font-bold ${correct ? "text-emerald-400" : "text-red-400"}`}>
            {correct ? "✓ Correct!" : "✗ Not quite right"}
          </p>
          {correct && (
            <p className="text-sm text-emerald-300 mt-2">
              +{xpAwarded} XP {combo > 1 && `(${combo}x combo)`}
            </p>
          )}
          {!correct && (
            <p className="text-sm text-red-300 mt-2">
              The correct answer is:{" "}
              <span className="font-bold">{exercise.gap_options.correct}</span>
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!answered ? (
          <Button
            onClick={mode === "gap-fill" ? handleSubmitGapFill : handleSubmitMCQ}
            disabled={
              mode === "gap-fill" ? !userAnswer : selectedOption === null
            }
            className="flex-1 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold hover:shadow-lg transition-all"
          >
            <span>Check Answer</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleReset}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
