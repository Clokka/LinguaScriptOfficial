import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface XPProgressProps {
  currentXP: number;
  levelXP: number;
  level: number;
  className?: string;
}

export const XPProgress = ({ currentXP, levelXP, level, className }: XPProgressProps) => {
  const progress = (currentXP / levelXP) * 100;

  return (
    <div className={cn("glass-panel p-4", className)}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <span className="font-bold text-primary-foreground text-sm">{level}</span>
          </div>
          <span className="text-sm font-medium text-foreground">Level {level}</span>
        </div>
        <div className="flex items-center gap-1 text-muted-foreground text-sm">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-foreground font-medium">{currentXP.toLocaleString()}</span>
          <span>/</span>
          <span>{levelXP.toLocaleString()} XP</span>
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
