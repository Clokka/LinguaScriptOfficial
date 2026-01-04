import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface DifficultyStarsProps {
  difficulty: number; // 1-5
  maxStars?: number;
  className?: string;
  showLabel?: boolean;
}

const difficultyLabels = ["Beginner", "Elementary", "Intermediate", "Advanced", "Expert"];

export const DifficultyStars = ({ 
  difficulty, 
  maxStars = 5, 
  className,
  showLabel = false 
}: DifficultyStarsProps) => {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="flex gap-0.5">
        {Array.from({ length: maxStars }).map((_, i) => (
          <Star
            key={i}
            className={cn(
              "w-4 h-4 difficulty-star transition-all duration-300",
              i < difficulty ? "filled text-warning" : "empty"
            )}
            fill={i < difficulty ? "currentColor" : "none"}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground ml-1">
          {difficultyLabels[difficulty - 1]}
        </span>
      )}
    </div>
  );
};
