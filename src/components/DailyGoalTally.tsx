import { Check, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "3 / 5 saved today" — the day's progress, and nothing louder.
 *
 * The product is built on turning up daily for a small amount, not on
 * bingeing. This used to hand the learner off to the old LinguaScripts SRS
 * review on "reached" — that flow is retired (see the Sentence Lab rebuild),
 * so reaching the goal now is just a quiet, complete win on its own.
 */
export interface DailyGoalTallyProps {
  savedToday: number;
  goal: number;
  /** Compact pill for the watch overlay; card for dashboards. */
  variant?: "pill" | "card";
  className?: string;
}

export function DailyGoalTally({ savedToday, goal, variant = "pill", className }: DailyGoalTallyProps) {
  const reached = savedToday >= goal;
  const pct = Math.min(100, Math.round((savedToday / Math.max(1, goal)) * 100));

  if (variant === "pill") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md",
          reached
            ? "border-[#34C759]/50 bg-[#34C759]/15 text-[#34C759]"
            : "border-white/15 bg-black/50 text-white/80",
          className,
        )}
      >
        {reached ? <Check className="h-3.5 w-3.5" /> : <Target className="h-3.5 w-3.5" />}
        <span className="tabular-nums">
          {Math.min(savedToday, goal)} / {goal} saved today
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        reached ? "border-[#34C759]/40 bg-[#34C759]/10" : "border-white/10 bg-white/[0.03]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Today's goal
          </p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
            {Math.min(savedToday, goal)} <span className="text-muted-foreground">/ {goal} words</span>
          </p>
        </div>
        {reached && (
          <span className="inline-flex items-center gap-2 rounded-full bg-[#34C759] px-4 py-2 text-sm font-bold text-black">
            <Check className="h-4 w-4" /> Done for today
          </span>
        )}
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: reached ? "#34C759" : "#FF8A00" }}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {reached
          ? "Goal reached — nice work. Come back tomorrow to keep the streak going."
          : "Small and daily beats big and occasional. Save a few words while you watch."}
      </p>
    </div>
  );
}

export default DailyGoalTally;
