import chameleon from "@/assets/brand/chameleon-green.png.asset.json";
import wordmark from "@/assets/brand/linguascript-wordmark.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * The single LinguaScript logo slot.
 *
 * Every header, sign-in card and onboarding step renders this rather than a
 * stand-in icon, so the brand is the same shape everywhere: the green chameleon
 * pin, optionally followed by the white/green wordmark.
 */
export interface BrandMarkProps {
  /** "pin" = chameleon only, "lockup" = chameleon + wordmark. */
  variant?: "pin" | "lockup";
  /** Pin height in px; the wordmark scales with it. */
  size?: number;
  className?: string;
}

export function BrandMark({ variant = "lockup", size = 32, className }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <img
        src={chameleon.url}
        alt="LinguaScript"
        width={size}
        height={size}
        className="object-contain drop-shadow-[0_2px_10px_rgba(52,199,89,0.35)]"
        style={{ height: size, width: size }}
      />
      {variant === "lockup" && (
        <img
          src={wordmark.url}
          alt="LinguaScript"
          className="object-contain"
          style={{ height: Math.round(size * 0.62), width: "auto" }}
        />
      )}
    </span>
  );
}

export default BrandMark;
