import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  gradient?: "primary" | "accent" | "success";
  className?: string;
}

export const FeatureCard = ({
  icon: Icon,
  title,
  description,
  gradient = "primary",
  className,
}: FeatureCardProps) => {
  const gradientClasses = {
    primary: "from-primary/20 to-primary/5 border-primary/20",
    accent: "from-accent/20 to-accent/5 border-accent/20",
    success: "from-success/20 to-success/5 border-success/20",
  };

  const iconClasses = {
    primary: "bg-gradient-primary shadow-glow-primary",
    accent: "bg-gradient-accent shadow-glow-accent",
    success: "bg-gradient-success shadow-glow-success",
  };

  return (
    <div
      className={cn(
        "glass-panel p-6 bg-gradient-to-br transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1",
        gradientClasses[gradient],
        className
      )}
    >
      <div
        className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center mb-4",
          iconClasses[gradient]
        )}
      >
        <Icon className="w-6 h-6 text-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
    </div>
  );
};
