import { DotLottieReact } from "@lottiefiles/dotlottie-react";
import lottieSrc from "@/assets/check-in-stream.lottie?url";
import { cn } from "@/lib/utils";

interface StreakLottieProps {
  active?: boolean;
  loop?: boolean;
  autoplay?: boolean;
  size?: number;
  className?: string;
}

/**
 * Renders the daily check-in Lottie. When `active` is false the animation is
 * grayscaled + dimmed to signal that the streak hasn't ignited yet today.
 */
export const StreakLottie = ({
  active = true,
  loop = true,
  autoplay = true,
  size = 96,
  className,
}: StreakLottieProps) => {
  return (
    <div
      className={cn(
        "shrink-0 transition-all duration-500",
        active ? "opacity-100" : "opacity-40 grayscale",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <DotLottieReact
        src={lottieSrc}
        loop={loop}
        autoplay={autoplay}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};
