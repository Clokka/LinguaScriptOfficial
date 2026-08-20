import { useCallback, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Lightbulb } from "lucide-react";
import confetti from "canvas-confetti";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import {
  answersMatch,
  blankTargetInSentence,
  maskWord,
  MAX_HINTS,
  recallXp,
  tierForRecall,
  type RecallOutcome,
} from "@/lib/activeRecall";

interface ActiveRecallReviewProps {
  exerciseId: string;
  sentence: string;
  targetWord: string;
  translation: string;
  /** Drives grading (accent/article handling) and hint copy. */
  language: string;
  onComplete: (data: { outcome: RecallOutcome; hintsUsed: number; xpEarned: number }) => void;
  onSkip: () => void;
}

/**
 * Active Recall: retrieve a word from its meaning alone, with progressive
 * hints instead of a single pass/fail check.
 *
 * This used to leak the answer twice over — the header printed the target
 * word directly above the prompt, and the carrier sentence contained it in
 * plain text — so "recall from memory" was, in practice, copy-typing a word
 * already on screen. It also graded with exact string equality, so a correct
 * answer with the wrong accent or a bare noun without its article was marked
 * wrong, and a correct-but-unaided answer earned exactly the same reward as
 * one where the app had just told the learner the answer.
 *
 * The chameleon now carries the result rather than a static red/emerald box:
 * red while unretrieved, orange the moment a hint is taken, green only on a
 * clean, unaided recall — the same three states the deck itself uses.
 */
export function ActiveRecallReview({
  exerciseId,
  sentence,
  targetWord,
  translation,
  language,
  onComplete,
  onSkip,
}: ActiveRecallReviewProps) {
  const [userAnswer, setUserAnswer] = useState("");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [outcome, setOutcome] = useState<RecallOutcome | null>(null);
  const [shake, setShake] = useState(0);
  const completedRef = useRef(false);

  const prompt = useMemo(
    () => blankTargetInSentence(sentence, targetWord, language),
    [sentence, targetWord, language],
  );

  const tier = tierForRecall(hintsUsed, outcome);
  const resolved = outcome !== null;
  const hintPreview = hintsUsed > 0 && !resolved ? maskWord(targetWord, hintsUsed) : null;

  const finish = useCallback(
    (finalOutcome: RecallOutcome, hints: number) => {
      if (completedRef.current) return;
      completedRef.current = true;
      setOutcome(finalOutcome);
      const xp = recallXp(finalOutcome, hints);

      if (finalOutcome === "clean") {
        confetti({
          particleCount: 60,
          spread: 65,
          origin: { x: 0.5, y: 0.5 },
          colors: ["#34C759", "#6BE08A", "#fbbf24"],
        });
      }

      window.setTimeout(
        () => onComplete({ outcome: finalOutcome, hintsUsed: hints, xpEarned: xp }),
        1100,
      );
    },
    [onComplete],
  );

  const handleSubmit = useCallback(() => {
    if (!userAnswer.trim() || resolved) return;

    if (answersMatch(userAnswer, targetWord, language)) {
      finish(hintsUsed > 0 ? "assisted" : "clean", hintsUsed);
      return;
    }

    // Wrong. Every miss earns another hint rather than an unlimited free
    // retry — a blind-guessing loop would let a learner "pass" without ever
    // retrieving anything.
    if (hintsUsed >= MAX_HINTS) {
      finish("revealed", hintsUsed);
      return;
    }
    setHintsUsed((h) => h + 1);
    setUserAnswer("");
    setShake((k) => k + 1);
  }, [userAnswer, resolved, targetWord, language, hintsUsed, finish]);

  return (
    <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-8">
      {/* Header — cues with meaning only. The target word is never printed
          here; ChameleonReview and the hint mask are the only places any
          part of it appears before the exercise resolves. */}
      <div className="mb-6 flex items-start gap-4">
        <ChameleonMascot
          tier={tier}
          party={outcome === "clean"}
          className="shrink-0"
          style={{ width: 96 }}
        />
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-amber-400">
            Active Recall
          </p>
          <h2 className="text-xl font-black leading-snug text-white">{translation}</h2>
          <p className="mt-1 text-xs text-slate-500">What's the word in the sentence below?</p>
        </div>
      </div>

      {/* Sentence, with the target word blanked — it used to be printed here
          in full, which made the exercise gradable by reading rather than
          remembering. */}
      <div
        key={shake}
        className="mb-4 rounded-lg border border-slate-700 bg-slate-800/50 p-6"
        style={shake ? { animation: "arr-shake 0.35s ease-in-out" } : undefined}
      >
        <style>{`
          @keyframes arr-shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-6px); }
            75% { transform: translateX(6px); }
          }
          @media (prefers-reduced-motion: reduce) {
            @keyframes arr-shake { 0%, 100% { transform: none; } }
          }
        `}</style>
        <p className="text-center text-lg leading-relaxed text-slate-200">{prompt}</p>
      </div>

      {hintPreview && (
        <p className="mb-4 text-center font-mono text-lg tracking-[0.3em] text-amber-300">
          {hintPreview}
        </p>
      )}

      <div className="mb-4">
        <Input
          placeholder="Type the word..."
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          disabled={resolved}
          autoFocus
          className="border-slate-600 bg-slate-700 text-white placeholder-slate-500 disabled:opacity-50"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !resolved) handleSubmit();
          }}
        />
      </div>

      {outcome && (
        <div
          className={`mb-4 rounded-lg p-4 ${
            outcome === "clean"
              ? "border border-emerald-500/40 bg-emerald-500/20"
              : outcome === "assisted"
                ? "border border-amber-500/40 bg-amber-500/20"
                : "border border-red-500/40 bg-red-500/20"
          }`}
        >
          <p
            className={`font-bold ${
              outcome === "clean"
                ? "text-emerald-400"
                : outcome === "assisted"
                  ? "text-amber-400"
                  : "text-red-400"
            }`}
          >
            {outcome === "clean" && "Clean recall!"}
            {outcome === "assisted" && "Got there with a hint."}
            {outcome === "revealed" && `The word is: ${targetWord}`}
          </p>
          <p className="mt-1 text-sm text-slate-300">
            {recallXp(outcome, hintsUsed) > 0
              ? `+${recallXp(outcome, hintsUsed)} XP`
              : "No XP this time — it'll come back around."}
          </p>
        </div>
      )}

      <div className="flex gap-3">
        {!resolved && (
          <Button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 font-bold text-white hover:shadow-lg"
          >
            <span>Check</span>
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
        {!resolved && (
          <Button
            onClick={onSkip}
            variant="outline"
            className="border-slate-600 px-6 text-slate-300 hover:bg-slate-700"
          >
            Skip
          </Button>
        )}
      </div>

      {!resolved && hintsUsed < MAX_HINTS && (
        <button
          type="button"
          onClick={() => {
            setHintsUsed((h) => h + 1);
            setUserAnswer("");
          }}
          className="mt-3 flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-amber-400"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {hintsUsed === 0 ? "Show a hint" : "Show another letter"}
        </button>
      )}
    </div>
  );
}
