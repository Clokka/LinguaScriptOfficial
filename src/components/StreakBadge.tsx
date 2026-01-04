import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakBadgeProps {
  streak: number;
  className?: string;
  showAnimation?: boolean;
}

export const StreakBadge = ({ streak, className, showAnimation = true }: StreakBadgeProps) => {
  return (
    <div
      className={cn(
        "glass-panel px-4 py-2 flex items-center gap-2",
        className
      )}
    >
      <div className={cn("text-accent", showAnimation && streak > 0 && "streak-fire")}>
        <Flame className="w-5 h-5" fill="currentColor" />
      </div>
      <span className="font-bold text-foreground">{streak}</span>
      <span className="text-muted-foreground text-sm">day streak</span>
    </div>
  );
};
