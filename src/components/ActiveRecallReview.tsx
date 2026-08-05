import { useState, useCallback, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle } from "lucide-react";
import confetti from "canvas-confetti";

interface ActiveRecallReviewProps {
  exerciseId: string;
  sentence: string;
  targetWord: string;
  translation: string;
  onComplete: (data: { correct: boolean; xpEarned: number }) => void;
  onSkip: () => void;
}

export function ActiveRecallReview({
  exerciseId,
  sentence,
  targetWord,
  translation,
  onComplete,
  onSkip,
}: ActiveRecallReviewProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);

  const handleSubmit = useCallback(() => {
    if (!userAnswer.trim() || answered) return;

    const isCorrect = userAnswer.toLowerCase().trim() === targetWord.toLowerCase().trim();
    const xp = isCorrect ? 25 : 0;

    setCorrect(isCorrect);
    setAnswered(true);
    setShowFeedback(true);
    setXpEarned(xp);

    if (isCorrect) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#fbbf24", "#fcd34d", "#34d399"],
      });
    }

    setTimeout(() => {
      onComplete({ correct: isCorrect, xpEarned: xp });
    }, 1200);
  }, [userAnswer, answered, targetWord, exerciseId, onComplete]);

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-block px-3 py-1 bg-red-500/20 rounded-lg mb-4">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest">
            Active Recall
          </p>
        </div>
        <h2 className="text-2xl font-black mb-2">
          Recall: <span className="text-red-400">{targetWord}</span>
        </h2>
        <p className="text-sm text-slate-400">{translation}</p>
      </div>

      {/* Sentence Display (NO BLANK SHOWN - pure recall) */}
      <div className="mb-8 p-6 bg-slate-800/50 rounded-lg border border-slate-700">
        <p className="text-lg text-slate-300 leading-relaxed text-center">
          {sentence}
        </p>
        <p className="text-xs text-slate-500 text-center mt-3">Type the missing word from memory</p>
      </div>

      {/* Input */}
      <div className="mb-6">
        <Input
          placeholder="Type the word..."
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={answered}
          className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 disabled:opacity-50"
          onKeyPress={(e) => e.key === "Enter" && !answered && handleSubmit()}
        />
      </div>

      {/* Feedback */}
      {showFeedback && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            correct ? "bg-emerald-500/20 border border-emerald-500/40" : "bg-red-500/20 border border-red-500/40"
          }`}
        >
          <p className={`font-bold ${correct ? "text-emerald-400" : "text-red-400"}`}>
            {correct ? "✓ Correct!" : "✗ Not quite"}
          </p>
          {correct && (
            <p className="text-sm text-emerald-300 mt-2">
              +{xpEarned} XP · Perfect active recall!
            </p>
          )}
          {!correct && (
            <p className="text-sm text-red-300 mt-2">
              The answer is: <span className="font-bold">{targetWord}</span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {!answered ? (
          <Button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold hover:shadow-lg transition-all"
          >
            <span>Check Answer</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={() => {
              setUserAnswer("");
              setAnswered(false);
              setShowFeedback(false);
            }}
            className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-bold"
          >
            Try Again
          </Button>
        )}
        <Button
          onClick={onSkip}
          variant="outline"
          className="px-6 border-slate-600 text-slate-300 hover:bg-slate-700"
        >
          Skip
        </Button>
      </div>
    </div>
  );
}
