import { cn } from "@/lib/utils";

/**
 * The streak flame — a flat, bold vector flame in the Block Blast palette.
 *
 * Two earlier attempts were wrong in the same way. A 24KB Lottie was stretched
 * from 72px to 460px and desaturated with a CSS filter, which is where the
 * artefacts came from. Replacing it with a canvas particle fire fixed the
 * scaling but not the look: a soft, glowy simulation is the opposite of this
 * product's visual language, which is WordBlock — flat, saturated, hard-bevelled
 * shapes. A smoke sim next to those tiles reads as cheap.
 *
 * So the flame is built the way the tiles are: layered solid shapes, a saturated
 * face, a light core, a hard dark edge. Colours come from the same values as
 * BLOCK_SKINS.orange and the Golden Reveal gold, so the flame belongs to the
 * family rather than visiting it.
 *
 * SVG, so it is crisp at 24px and at 460px. Roughly 2KB and no dependency.
 */

interface StreakFlameProps {
  /**
   * A cold streak keeps the exact silhouette and drops to the slate tile skin.
   * Reading "not lit" beats reading "broken image", which is what greyscaling a
   * full-colour animation always looked like.
   */
  active?: boolean;
  size?: number;
  className?: string;
}

/** Matches BLOCK_SKINS in components/blocks/WordBlock.tsx. */
const LIT = {
  outerFrom: "#FF8A00",
  outerTo: "#C46500",
  innerFrom: "#FFB44D",
  innerTo: "#FF8A00",
  coreFrom: "#FFF3C4",
  coreTo: "#FFD54A",
  glow: "rgba(255,138,0,0.45)",
};

const COLD = {
  outerFrom: "#4A4A57",
  outerTo: "#2A2A33",
  innerFrom: "#5A5A69",
  innerTo: "#41414D",
  coreFrom: "#6E6E7D",
  coreTo: "#4A4A57",
  glow: "rgba(0,0,0,0)",
};

export const StreakFlame = ({ active = true, size = 96, className }: StreakFlameProps) => {
  const c = active ? LIT : COLD;
  const uid = active ? "lit" : "cold";

  return (
    <div
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes ls-flame-core {
          0%, 100% { transform: scaleY(1) translateY(0); }
          50%      { transform: scaleY(0.9) translateY(2px); }
        }
        @keyframes ls-flame-inner {
          0%, 100% { transform: scaleY(1); }
          50%      { transform: scaleY(0.94); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ls-flame-core, .ls-flame-inner { animation: none !important; }
        }
      `}</style>

      <svg viewBox="0 0 64 80" width="100%" height="100%" role="img">
        <defs>
          <linearGradient id={`fo-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.outerFrom} />
            <stop offset="100%" stopColor={c.outerTo} />
          </linearGradient>
          <linearGradient id={`fi-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.innerFrom} />
            <stop offset="100%" stopColor={c.innerTo} />
          </linearGradient>
          <linearGradient id={`fc-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.coreFrom} />
            <stop offset="100%" stopColor={c.coreTo} />
          </linearGradient>
        </defs>

        {active && (
          <ellipse cx="32" cy="58" rx="26" ry="22" fill={c.glow} opacity="0.55">
            <animate
              attributeName="opacity"
              values="0.42;0.62;0.42"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </ellipse>
        )}

        {/* Outer body. A waist at the middle is what separates a flame
            silhouette from a teardrop. */}
        <path
          d="M32 3c0 0 13 16 13 28 0 8-4 12-4 18 0 6 6 8 8 14 3 9-5 16-17 16S12 72 15 63c2-6 8-8 8-14 0-6-4-10-4-18C19 19 32 3 32 3Z"
          fill={`url(#fo-${uid})`}
        />

        <path
          className="ls-flame-inner"
          style={{ animation: "ls-flame-inner 1.9s ease-in-out infinite", transformOrigin: "32px 74px" }}
          d="M32 21c0 0 7 11 7 18 0 5-3 8-3 12 0 5 4 6 4 10 0 5-4 8-8 8s-8-3-8-8c0-4 4-5 4-10 0-4-3-7-3-12 0-7 7-18 7-18Z"
          fill={`url(#fi-${uid})`}
        />

        <path
          className="ls-flame-core"
          style={{ animation: "ls-flame-core 1.4s ease-in-out infinite", transformOrigin: "32px 74px" }}
          d="M32 44c0 0 4 6 4 11 0 4-2 5-2 8 0 3 2 4 2 6 0 3-2 4-4 4s-4-1-4-4c0-2 2-3 2-6 0-3-2-4-2-8 0-5 4-11 4-11Z"
          fill={`url(#fc-${uid})`}
        />
      </svg>
    </div>
  );
};

export default StreakFlame;
