import { useState, useEffect } from "react";
import { useContext } from "react";
import { useXp } from "@/hooks/useXp";
import { useComboTracker } from "@/hooks/useComboTracker";
import { PetContext } from "@/contexts/PetContext";
import {
  generateLinguaScript,
  createLinguaScript,
  submitGapFill,
  submitMCQ,
  skipLinguascript,
  type LinguaScript,
  type GeneratedContent,
} from "@/lib/linguascripts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import confetti from "canvas-confetti";

type ExerciseMode = "gap-fill" | "mcq" | "speaking";

interface LinguaScriptExerciseProps {
  targetWord: string;
  language: string;
  interests?: string[];
  mode?: ExerciseMode;
  onComplete?: (script: LinguaScript) => void;
}

export function LinguaScriptExercise({
  targetWord,
  language,
  interests = [],
  mode = "gap-fill",
  onComplete,
}: LinguaScriptExerciseProps) {
  const [loading, setLoading] = useState(true);
  const [script, setScript] = useState<LinguaScript | null>(null);
  const [content, setContent] = useState<GeneratedContent | null>(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [userAnswer, setUserAnswer] = useState("");
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const xp = useXp();
  const petCtx = useContext(PetContext);
  const { combo, recordCorrect, recordIncorrect, recordSkip } = useComboTracker();

  // Generate content on mount
  useEffect(() => {
    generateContent();
  }, [targetWord, language]);

  async function generateContent() {
    try {
      setLoading(true);
      setError(null);

      // Generate AI content
      const generated = await generateLinguaScript(
        targetWord,
        language,
        interests
      );
      setContent(generated);

      // Create DB record
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Not authenticated");

      const created = await createLinguaScript(
        user.id,
        language,
        targetWord,
        generated
      );

      setScript(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmitGapFill() {
    if (!script || !content) return;

    try {
      const { correct: isCorrect, xp } = await submitGapFill(
        script.id,
        userAnswer,
        content.gapOptions.correct,
        combo
      );

      setCorrect(isCorrect);
      setAnswered(true);

      // Update XP and trigger celebration
      if (isCorrect) {
        xp.award("review_card", { correct: true });
        recordCorrect();

        // Trigger pet celebration
        petCtx?.celebrate("learning_milestone");

        // Trigger line blast effect
        triggerBlastEffect();

        // Award confetti
        if (combo >= 2) {
          confetti({
            particleCount: Math.min(40 + combo * 30, 170),
            spread: 60,
            origin: { y: 0.6 },
          });
        }
      } else {
        recordIncorrect();
      }

      // Refetch script
      if (script.id) {
        const { data } = await supabase
          .from("linguascripts")
          .select("*")
          .eq("id", script.id)
          .single();
        if (data) setScript(data as LinguaScript);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  async function handleSubmitMCQ() {
    if (!script || !content || selectedOption === null) return;

    try {
      const { correct: isCorrect, xp } = await submitMCQ(
        script.id,
        selectedOption,
        content.mcqOptions.correct,
        combo
      );

      setCorrect(isCorrect);
      setAnswered(true);

      if (isCorrect) {
        xp.award("review_card", { correct: true });
        recordCorrect();
        petCtx?.celebrate("learning_milestone");
        triggerBlastEffect();

        if (combo >= 2) {
          confetti({
            particleCount: Math.min(40 + combo * 30, 170),
            spread: 60,
            origin: { y: 0.6 },
          });
        }
      } else {
        recordIncorrect();
      }

      const { data } = await supabase
        .from("linguascripts")
        .select("*")
        .eq("id", script.id)
        .single();
      if (data) setScript(data as LinguaScript);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    }
  }

  async function handleSkip() {
    if (!script) return;

    try {
      await skipLinguascript(script.id);
      recordSkip();
      onComplete?.(script);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to skip");
    }
  }

  function triggerBlastEffect() {
    // This would trigger the Line Blast animation
    // In a full implementation, this would be a React component rendered
    // to trigger the animation sequence from the prototype
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">
            Generating your LinguaScript...
          </p>
        </div>
      </div>
    );
  }

  if (!content || !script) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error || "Failed to generate"}</p>
        <Button onClick={generateContent}>Try Again</Button>
      </div>
    );
  }

  // Gap-fill mode
  if (mode === "gap-fill") {
    const words = content.sentence.split(" ");
    const sentenceWithGap = words.map((w, i) =>
      w === "_____" ? `[${content.gapOptions.correct}]` : w
    );

    return (
      <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
        {/* Sentence with gap */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <p className="text-lg font-medium text-white mb-4">
            {content.sentence}
          </p>
          <p className="text-sm text-slate-400">{content.translation}</p>
        </div>

        {/* Input for gap-fill */}
        {!answered ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Fill in the blank:
              </label>
              <Input
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                placeholder={`Enter the missing word...`}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSubmitGapFill();
                }}
                className="text-base"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSubmitGapFill} className="flex-1">
                Check Answer
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {correct ? (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4">
                <p className="text-emerald-500 font-semibold">Correct! 🎉</p>
                <p className="text-sm text-emerald-500/80 mt-1">
                  +{script.xp_earned} XP {combo > 1 && `(×${combo})`}
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
                <p className="text-red-500 font-semibold">Not quite right</p>
                <p className="text-sm text-red-500/80 mt-1">
                  The answer is: <span className="font-semibold">{content.gapOptions.correct}</span>
                </p>
              </div>
            )}

            <Button onClick={() => onComplete?.(script)} className="w-full">
              Next Exercise
            </Button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    );
  }

  // MCQ mode
  if (mode === "mcq") {
    return (
      <div className="w-full max-w-2xl mx-auto p-6 space-y-6">
        {/* Sentence */}
        <div className="bg-slate-900 rounded-lg p-6 border border-slate-700">
          <p className="text-lg font-medium text-white mb-4">
            {content.sentence}
          </p>
          <p className="text-sm text-slate-400">{content.translation}</p>
        </div>

        {/* Question */}
        <div className="space-y-2">
          <p className="font-medium">
            What does <span className="font-bold text-emerald-500">{targetWord}</span> mean?
          </p>
        </div>

        {/* MCQ Options */}
        {!answered ? (
          <div className="space-y-3">
            {content.mcqOptions.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedOption(idx)}
                className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                  selectedOption === idx
                    ? "bg-emerald-500/20 border-emerald-500"
                    : "bg-slate-900 border-slate-700 hover:border-slate-600"
                }`}
              >
                {option}
              </button>
            ))}

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSubmitMCQ}
                disabled={selectedOption === null}
                className="flex-1"
              >
                Check Answer
              </Button>
              <Button
                onClick={handleSkip}
                variant="outline"
                className="flex-1"
              >
                Skip
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {correct ? (
              <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4">
                <p className="text-emerald-500 font-semibold">Correct! 🎉</p>
                <p className="text-sm text-emerald-500/80 mt-1">
                  +{script.xp_earned} XP {combo > 1 && `(×${combo})`}
                </p>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/40 rounded-lg p-4">
                <p className="text-red-500 font-semibold">Not quite right</p>
                <p className="text-sm text-red-500/80 mt-1">
                  The answer is: <span className="font-semibold">{content.mcqOptions.options[content.mcqOptions.correct]}</span>
                </p>
              </div>
            )}

            <Button onClick={() => onComplete?.(script)} className="w-full">
              Next Exercise
            </Button>
          </div>
        )}

        {error && (
          <p className="text-red-500 text-sm">{error}</p>
        )}
      </div>
    );
  }

  return null;
}
