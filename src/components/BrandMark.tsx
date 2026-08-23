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

export function BrandMark({ variant = "lockup", size = 40, className }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2 select-none", className)}>
      <img
        src="/favicon-512x512.png"
        alt="LinguaScript"
        width={size}
        height={size}
        className="object-contain drop-shadow-[0_2px_10px_rgba(52,199,89,0.35)]"
        style={{ height: size, width: size }}
      />
      {variant === "lockup" && (
        <span
          aria-hidden="true"
          className="font-extrabold leading-none text-foreground"
          style={{ fontSize: Math.round(size * 0.55) }}
        >
          lingua<span className="text-brand-green">script</span>
        </span>
      )}
    </span>
  );
}

export default BrandMark;
