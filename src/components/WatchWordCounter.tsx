import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { DECK } from "@/lib/deck-colors";
import { cn } from "@/lib/utils";

const GREEN = DECK.green;

/**
 * Slim bar under the video: "Words saved 2/8" + a Review button.
 * Never pauses or blocks the video — reviewing is always the learner's choice.
 */
export function WatchWordCounter({
  savedToday,
  goal,
  onReview,
  className,
}: {
  savedToday: number;
  goal: number;
  onReview: () => void;
  className?: string;
}) {
  const g = Math.max(1, goal);
  const done = savedToday >= g;
  const extra = Math.max(0, savedToday - g);
  const pct = Math.min(100, Math.round((savedToday / g) * 100));
  const [pop, setPop] = useState(0);
  const prev = useRef(savedToday);
  useEffect(() => {
    if (savedToday > prev.current) setPop((p) => p + 1);
    prev.current = savedToday;
  }, [savedToday]);

  return (
    <div
      className={cn("w-full flex items-center gap-3 rounded-xl border px-3 py-2", className)}
      style={{ borderColor: `${GREEN}55`, background: `${GREEN}14` }}
    >
      <div className="flex-1 min-w-0">
        <motion.p
          key={pop}
          initial={{ scale: pop ? 1.12 : 1 }}
          animate={{ scale: 1 }}
          className="text-sm font-semibold text-white truncate"
        >
          {done ? "Goal reached: " : "Words saved "}
          <span style={{ color: GREEN }}>
            {Math.min(savedToday, g)}/{g}
          </span>
          {extra > 0 && <span className="text-white/70"> +{extra}</span>}
          {done && " words saved"}
        </motion.p>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: GREEN }} />
        </div>
      </div>
      <button
        onClick={onReview}
        disabled={savedToday === 0}
        className={cn(
          "shrink-0 inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-bold text-black transition-opacity disabled:opacity-40",
          done && "animate-pulse",
        )}
        style={{ background: GREEN }}
      >
        {done ? `Review your ${savedToday} words` : "Review in Flashcards"}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
