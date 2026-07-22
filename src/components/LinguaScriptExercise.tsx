import { useState, useEffect } from "react";
import { useContext } from "react";
import { useComboTracker } from "@/hooks/useComboTracker";
import { PetContext } from "@/contexts/PetContext";
import { updateSrsAfterLinguaScript } from "@/lib/linguascripts";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import confetti from "canvas-confetti";

type ExerciseMode = "gap-fill" | "mcq" | "speaking";

interface LinguaScriptExerciseProps {
  targetWord: string;
  language: string;
  interests?: string[];
  mode?: ExerciseMode;
  onComplete?: (script: any) => void;
}

// Demo exercises for testing
const DEMO_EXERCISES = {
  bonjour: {
    sentence: "______ ! Comment allez-vous?",
    translation: "Hello! How are you?",
    gapOptions: { correct: "Bonjour", distractors: ["Bonsoir", "Salut", "Au revoir"] },
    mcqOptions: { correct: 0, options: ["Bonjour", "Bonsoir", "Salut", "Au revoir"] },
  },
  remplir: {
    sentence: "Je voudrais ______ cette bouteille d'eau.",
    translation: "I would like to fill this water bottle.",
    gapOptions: { correct: "remplir", distractors: ["donner", "prendre", "mettre"] },
    mcqOptions: { correct: 0, options: ["remplir", "donner", "prendre", "mettre"] },
  },
  commander: {
    sentence: "Je voudrais ______ une salade, s'il vous plaît.",
    translation: "I would like to order a salad, please.",
    gapOptions: { correct: "commander", distractors: ["manger", "goûter", "servir"] },
    mcqOptions: { correct: 0, options: ["commander", "manger", "goûter", "servir"] },
  },
};

export function LinguaScriptExercise({
  targetWord,
  language,
  interests = [],
  mode = "gap-fill",
  onComplete,
}: LinguaScriptExerciseProps) {
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [xpAwarded, setXpAwarded] = useState(0);

  const petCtx = useContext(PetContext);
  const { combo, recordCorrect, recordIncorrect } = useComboTracker();

  // Get demo exercise
  const exercise = DEMO_EXERCISES[targetWord as keyof typeof DEMO_EXERCISES] || DEMO_EXERCISES.bonjour;
  const correctAnswer = exercise.gapOptions.correct;

  function handleSubmitGapFill() {
    const isCorrect = userAnswer.toLowerCase().trim() === correctAnswer.toLowerCase();
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

    // Trigger line blast effect
    setTimeout(() => {
      onComplete?.({
        id: `demo-${targetWord}`,
        target_word: targetWord,
        xp_earned: xpWithCombo,
        combo_multiplier: combo,
        status: isCorrect ? "completed" : "started",
      });
    }, 800);
  }

  function handleSubmitMCQ() {
    if (selectedOption === null) return;

    const isCorrect = selectedOption === exercise.mcqOptions.correct;
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

    setTimeout(() => {
      onComplete?.({
        id: `demo-${targetWord}`,
        target_word: targetWord,
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

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-block px-3 py-1 bg-amber-500/20 rounded-lg mb-4">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            {mode === "gap-fill" ? "Gap-Fill Exercise" : "Multiple Choice"}
          </p>
        </div>
        <h2 className="text-2xl font-black mb-2">Learn: <span className="text-amber-400">{targetWord}</span></h2>
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
              {exercise.mcqOptions.options.map((option, idx) => (
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
                    <div className={`w-6 h-6 rounded border-2 flex items-center justify-center ${
                      selectedOption === idx ? "border-amber-400 bg-amber-400" : "border-slate-500"
                    }`}>
                      {selectedOption === idx && <span className="text-slate-900 font-bold">✓</span>}
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
        <div className={`mb-6 p-4 rounded-lg ${
          correct
            ? "bg-emerald-500/20 border border-emerald-500/40"
            : "bg-red-500/20 border border-red-500/40"
        }`}>
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
              The correct answer is: <span className="font-bold">{correctAnswer}</span>
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {!answered ? (
          <Button
            onClick={mode === "gap-fill" ? handleSubmitGapFill : handleSubmitMCQ}
            disabled={mode === "gap-fill" ? !userAnswer : selectedOption === null}
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

      {/* Demo Notice */}
      <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-xs text-blue-400">
        📝 Demo Mode: Using sample exercises. Apply database migrations to use AI-generated sentences.
      </div>
    </div>
  );
}
