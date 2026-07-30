import { cn } from "@/lib/utils";

/**
 * The LinguaScript chameleon, drawn as inline SVG so its colour can be
 * animated. The deck colours (red / orange / green) are the brand's core
 * semantic system — see brand/README.md — so the mascot is tinted from a
 * single `color` prop and every derived tone is mixed from it.
 *
 * Inline SVG rather than the GLB on purpose: this needs to recolour smoothly
 * at 60fps during the scroll showpiece, which a 678 KB textured mesh cannot.
 */
export interface ChameleonMarkProps {
  /** Body colour — pass a deck hex (#FF3B30 / #FF8A00 / #34C759). */
  color: string;
  /** Render the branch under the feet. */
  branch?: boolean;
  className?: string;
}

export const ChameleonMark = ({ color, branch = true, className }: ChameleonMarkProps) => {
  // Derived tones, so callers only ever pass one colour.
  const belly = `color-mix(in srgb, ${color} 18%, #ffffff)`;
  const eyeRing = `color-mix(in srgb, ${color} 12%, #ffffff)`;
  const ridge = `color-mix(in srgb, ${color} 82%, #000000)`;

  return (
    <svg
      viewBox="0 0 480 260"
      fill="none"
      role="img"
      aria-label="LinguaScript chameleon"
      className={cn("w-full h-auto", className)}
      style={{ transition: "none" }}
    >
      {branch && (
        <path
          d="M18 214 C 130 236, 300 224, 462 196"
          stroke="#7A4A28"
          strokeWidth="15"
          strokeLinecap="round"
        />
      )}

      {/* Back legs */}
      <rect x="288" y="168" width="21" height="52" rx="10.5" fill={color} />
      {/* Front legs */}
      <rect x="212" y="168" width="21" height="62" rx="10.5" fill={color} />

      {/* Tail — curls up and round from the rear of the body */}
      <path
        d="M362 148 C 410 148, 432 172, 428 194 C 424 216, 398 224, 384 210 C 372 198, 380 182, 394 184 C 402 185, 406 192, 402 197"
        stroke={color}
        strokeWidth="20"
        strokeLinecap="round"
        fill="none"
      />

      {/* Body */}
      <ellipse cx="272" cy="132" rx="104" ry="76" fill={color} />

      {/* Dorsal ridge */}
      <path
        d="M196 74 L206 60 L216 74 L226 60 L236 74 L246 60 L256 74 L266 60 L276 74 L286 60 L296 74 L306 60 L316 74 Z"
        fill={ridge}
      />
      <rect x="196" y="72" width="124" height="12" rx="6" fill={ridge} />

      {/* Belly patch */}
      <path
        d="M214 150 C 214 122, 232 104, 252 104 C 236 122, 236 158, 252 176 C 232 176, 214 170, 214 150 Z"
        fill={belly}
      />

      {/* Head */}
      <path
        d="M96 128 C 96 82, 128 54, 168 54 C 208 54, 232 82, 232 128 C 232 174, 208 198, 168 198 C 128 198, 96 174, 96 128 Z"
        fill={color}
      />

      {/* Mouth */}
      <path
        d="M104 148 C 126 172, 168 174, 190 156"
        stroke="#5A3A20"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />

      {/* Eye */}
      <circle cx="164" cy="112" r="38" fill={eyeRing} />
      <circle cx="160" cy="110" r="15" fill="#14110F" />
      <circle cx="165" cy="105" r="5" fill="#FFFFFF" />
    </svg>
  );
};

export default ChameleonMark;
