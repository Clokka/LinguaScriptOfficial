// The daily quest: save N words -> celebrate -> review -> build. Review and
// build are one continuous LinguaScriptSession (gap-fill, tile-builder,
// active-recall, then production per word — see R6/R7); this card is purely
// the progress/CTA surface, and the host screen owns actually opening that
// session so it can take over the full page the same way it already does
// for the existing linguascripts-pending flow.
import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { Sparkles, PartyPopper, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DailyQuestProgress, QuestStage } from "@/lib/dailyQuest";

interface DailyQuestCardProps {
  stage: QuestStage;
  progress: DailyQuestProgress;
  goal: number;
  loading: boolean;
  hasWordsToReview: boolean;
  onCelebrated: () => void;
  onStart: () => void;
}

export function DailyQuestCard({
  stage,
  progress,
  goal,
  loading,
  hasWordsToReview,
  onCelebrated,
  onStart,
}: DailyQuestCardProps) {
  const celebratedRef = useRef(false);

  useEffect(() => {
    if (stage !== "celebrate" || celebratedRef.current) return;
    celebratedRef.current = true;
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.4 },
      colors: ["#fbbf24", "#34d399", "#60a5fa"],
    });
    onCelebrated();
  }, [stage, onCelebrated]);

  if (loading || (stage === "saving" && progress.wordsSaved === 0)) return null;

  if (stage === "done") {
    return (
      <div className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
        <PartyPopper className="w-4 h-4" />
        Today's quest is complete — words saved, reviewed, and built into sentences.
      </div>
    );
  }

  if (stage === "saving") {
    const pct = Math.min(100, Math.round((progress.wordsSaved / goal) * 100));
    return (
      <div className="mb-6 rounded-2xl border border-border/60 bg-card/50 p-5">
        <p className="text-sm font-semibold text-foreground mb-2">
          Today's quest: save {goal} word{goal === 1 ? "" : "s"}
        </p>
        <div className="w-full h-2 bg-secondary rounded-full overflow-hidden mb-2">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {progress.wordsSaved} of {goal} saved today — save a word from any video to keep going.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-amber-400" />
        <p className="text-sm font-semibold text-foreground">
          {progress.wordsSaved} word{progress.wordsSaved === 1 ? "" : "s"} saved today!
        </p>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        {stage === "build"
          ? "You started reviewing — finish building sentences with today's words."
          : "Review them, then build a sentence with each one."}
      </p>
      {hasWordsToReview ? (
        <Button onClick={onStart} className="gap-2">
          {stage === "build" ? "Finish building" : "Review & build"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Nothing due to review right now — nice work.</p>
      )}
    </div>
  );
}
