// MOTIVATION LAYER — the always-visible progress bar.
//
// Lives in every main page header so the bar is never more than a glance away:
// watching it inch forward after each saved word is the core feedback loop.
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useXp } from "@/contexts/XpContext";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export const LevelBadge = ({ className }: { className?: string }) => {
  const { level, current, nextLevelXP, levelProgress } = useXp();
  const navigate = useNavigate();
  const remaining = Math.max(0, nextLevelXP - current);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => navigate("/progress")}
          aria-label={`Level ${level}, ${current} of ${nextLevelXP} XP.`}
          className={cn(
            "group flex items-center gap-2.5 rounded-full pl-1.5 pr-3 py-1.5",
            "border border-border/70 bg-secondary/40 hover:bg-secondary/70",
            "transition-colors focus-visible:outline-none focus-visible:ring-2",
            "focus-visible:ring-primary/60",
            className,
          )}
        >
          {/* Level pip */}
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
              "bg-gradient-primary text-primary-foreground",
              "text-xs font-bold tabular-nums shadow-glow-primary",
            )}
          >
            {level}
          </span>

          {/* Progress track — the bit that moves */}
          <span className="hidden sm:flex flex-col gap-1 w-24">
            <span className="flex items-baseline justify-between text-[10px] leading-none text-muted-foreground">
              <span className="font-medium uppercase tracking-wider">Level</span>
              <span className="tabular-nums">
                {current.toLocaleString()}/{nextLevelXP.toLocaleString()}
              </span>
            </span>
            <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full xp-bar-fill transition-[width] duration-500 ease-out"
                style={{ width: `${levelProgress * 100}%` }}
              />
            </span>
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[220px]">
        <p className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {remaining.toLocaleString()} XP to level {level + 1}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};
