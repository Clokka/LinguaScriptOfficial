import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useXp } from "@/contexts/XpContext";

interface XPProgressProps {
  currentXP?: number;
  levelXP?: number;
  level?: number;
  className?: string;
}

export const XPProgress = ({ currentXP, levelXP, level, className }: XPProgressProps) => {
  const ctx = useXp();
  const cur = currentXP ?? ctx.current;
  const total = levelXP ?? ctx.nextLevelXP;
  const lvl = level ?? ctx.level;
  const progress = total > 0 ? (cur / total) * 100 : 0;

  return (
    <div className={cn("glass-panel p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <span className="font-bold text-primary-foreground text-sm">{lvl}</span>
          </div>
          <span className="text-sm font-medium text-foreground">Level {lvl}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-foreground font-medium">{cur.toLocaleString()}</span>
          <span>/</span>
          <span>{total.toLocaleString()} XP</span>
        </div>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full xp-bar-fill rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
