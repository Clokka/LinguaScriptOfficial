import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, AlertCircle, Loader2 } from "lucide-react";
import confetti from "canvas-confetti";

interface Sentence {
  word: string;
  userText: string;
  score: number; // 50, 30, 15, or 0
  feedback: string;
}

interface LinguaScriptCreationProps {
  words: string[]; // Words to use in sentences
  onComplete: (data: {
    sentences: Sentence[];
    totalXp: number;
  }) => void;
  onSkip: () => void;
}

export function LinguaScriptCreation({
  words,
  onComplete,
  onSkip,
}: LinguaScriptCreationProps) {
  const [sentences, setSentences] = useState<Sentence[]>(
    words.map((w) => ({ word: w, userText: "", score: 0, feedback: "" }))
  );
  const [evaluating, setEvaluating] = useState(false);
  const [evaluated, setEvaluated] = useState(false);

  const handleSentenceChange = useCallback((index: number, text: string) => {
    setSentences((prev) => {
      const next = [...prev];
      next[index].userText = text;
      return next;
    });
  }, []);

  const handleEvaluate = useCallback(async () => {
    // Validate all sentences have text
    if (sentences.some((s) => !s.userText.trim())) {
      alert("Please write a sentence for each word.");
      return;
    }

    setEvaluating(true);

    try {
      // Call AI evaluation endpoint
      // For now, this is a stub that will be replaced with real AI
      const response = await fetch("/api/evaluate-linguascripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sentences: sentences.map((s) => ({
            word: s.word,
            text: s.userText,
          })),
        }),
      });

      if (!response.ok) throw new Error("Evaluation failed");

      const evaluated = await response.json();

      setSentences((prev) =>
        prev.map((s, i) => ({
          ...s,
          score: evaluated[i].score,
          feedback: evaluated[i].feedback,
        }))
      );

      setEvaluated(true);

      // Trigger confetti for good performance
      const totalScore = evaluated.reduce((sum: number, e: any) => sum + e.score, 0);
      if (totalScore >= 300) {
        // 6/10 sentences at 50 XP
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#fbbf24", "#fcd34d", "#34d399", "#6ee7b7"],
        });
      }
    } catch (err) {
      console.error("Evaluation error:", err);
      alert("Error evaluating sentences. Try again.");
    } finally {
      setEvaluating(false);
    }
  }, [sentences]);

  const totalXp = sentences.reduce((sum, s) => sum + s.score, 0);

  const handleComplete = useCallback(() => {
    onComplete({
      sentences,
      totalXp,
    });
  }, [sentences, totalXp, onComplete]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8">
        <div className="inline-block px-3 py-1 bg-amber-500/20 rounded-lg mb-4">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            LinguaScript Creation
          </p>
        </div>
        <h2 className="text-2xl font-black mb-2">Make Sentences</h2>
        <p className="text-sm text-slate-400">
          Write a sentence using each word. Use complete, natural sentences.
        </p>
      </div>

      {/* Sentence Inputs */}
      <div className="space-y-4">
        {sentences.map((sentence, index) => (
          <div
            key={index}
            className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-6"
          >
            {/* Word Label */}
            <div className="mb-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">
                Word {index + 1}
              </p>
              <p className="text-lg font-bold text-amber-400">{sentence.word}</p>
            </div>

            {/* Input */}
            {!evaluated ? (
              <Textarea
                placeholder="Write a sentence using this word..."
                value={sentence.userText}
                onChange={(e) => handleSentenceChange(index, e.target.value)}
                disabled={evaluating}
                className="bg-slate-700 border-slate-600 text-white placeholder-slate-500 disabled:opacity-50 resize-none"
                rows={3}
              />
            ) : (
              <>
                {/* Display user's sentence */}
                <div className="mb-3 p-3 bg-slate-700/50 rounded-lg">
                  <p className="text-slate-200 italic">{sentence.userText}</p>
                </div>

                {/* Score & Feedback */}
                <div
                  className={`p-4 rounded-lg border ${
                    sentence.score >= 30
                      ? "bg-emerald-500/20 border-emerald-500/40"
                      : sentence.score >= 15
                        ? "bg-amber-500/20 border-amber-500/40"
                        : "bg-red-500/20 border-red-500/40"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <p
                      className={`font-bold ${
                        sentence.score >= 30
                          ? "text-emerald-400"
                          : sentence.score >= 15
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {sentence.score >= 50
                        ? "Perfect"
                        : sentence.score >= 30
                          ? "Great"
                          : sentence.score >= 15
                            ? "Good"
                            : "Try Again"}
                    </p>
                    <p className="text-sm font-bold text-slate-300">+{sentence.score} XP</p>
                  </div>
                  <p className="text-sm text-slate-300">{sentence.feedback}</p>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {!evaluated ? (
          <>
            <Button
              onClick={handleEvaluate}
              disabled={evaluating || sentences.some((s) => !s.userText.trim())}
              className="flex-1 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {evaluating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Evaluating...
                </>
              ) : (
                <>
                  <span>Evaluate All</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
            <Button
              onClick={onSkip}
              variant="outline"
              className="px-6 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              Skip
            </Button>
          </>
        ) : (
          <Button
            onClick={handleComplete}
            className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold hover:shadow-lg transition-all"
          >
            <span>Complete Session</span>
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {evaluated && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-4 text-center">
          <p className="text-sm text-slate-300">
            Session Total: <span className="font-bold text-amber-400">{totalXp} XP</span>
          </p>
        </div>
      )}
    </div>
  );
}
