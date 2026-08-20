import { cn } from "@/lib/utils";

interface StreakFlameProps {
  active?: boolean;
  size?: number;
  className?: string;
}

// Exact values from BLOCK_SKINS in components/blocks/WordBlock.tsx
// orange: [face, light highlight, dark bevel]
// slate:  [face, light highlight, dark bevel]
const LIT  = { face: "#FF8A00", light: "#FFB44D", dark: "#C46500", warm: "#FFD54A", hot: "#FFF3C4" };
const COLD = { face: "#41414d", light: "#5a5a69", dark: "#2a2a33", warm: "#41414d", hot: "#5a5a69" };

export const StreakFlame = ({ active = true, size = 96, className }: StreakFlameProps) => {
  const c = active ? LIT : COLD;
  const id = active ? "a" : "b";

  return (
    <div
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes ls-rock {
          0%,100% { transform: rotate(-1deg); }
          33%      { transform: rotate(1.5deg); }
          66%      { transform: rotate(-0.5deg); }
        }
        @keyframes ls-bob {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-2px); }
        }
        @keyframes ls-breathe {
          0%,100% { opacity: 0.2; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(1.08); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ls-fb, .ls-fi, .ls-fg { animation: none !important; transform: none !important; }
        }
      `}</style>

      <svg viewBox="0 0 64 96" width="100%" height="100%">
        <defs>
          {/* Face gradient: light top-left → saturated face → hard dark bottom-right */}
          <linearGradient id={`lf-${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%"   stopColor={c.light} />
            <stop offset="35%"  stopColor={c.face} />
            <stop offset="100%" stopColor={c.dark} />
          </linearGradient>
          <linearGradient id={`li-${id}`} x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%"   stopColor={c.warm} />
            <stop offset="100%" stopColor={c.face} />
          </linearGradient>
        </defs>

        {/* Ambient glow pool — active only */}
        {active && (
          <ellipse
            cx="32" cy="88" rx="30" ry="8"
            fill={c.face}
            className="ls-fg"
            style={{ animation: "ls-breathe 2.4s ease-in-out infinite", transformOrigin: "32px 88px" }}
          />
        )}

        {/* Hard bevel — mirrors WordBlock's box-shadow: 0 6px 0 ${dark} */}
        <ellipse cx="32" cy="88" rx="20" ry="5" fill={c.dark} />

        {/* Outer flame body — gradient face, same treatment as a WordBlock tile */}
        <path
          d="M32 6C36 14 50 24 50 40C50 54 44 60 46 70C48 76 52 78 50 82C46 86 40 88 32 88C24 88 18 86 14 82C12 78 16 76 18 70C20 60 14 54 14 40C14 24 28 14 32 6Z"
          fill={`url(#lf-${id})`}
          className="ls-fb"
          style={{
            animation: active ? "ls-rock 2s ease-in-out infinite" : "none",
            transformOrigin: "32px 88px",
          }}
        />

        {/* Inner flame — brighter, narrower */}
        <path
          d="M32 28C35 34 42 42 42 52C42 62 38 66 40 72C41 76 44 78 42 82C40 86 36 88 32 88C28 88 24 86 22 82C20 78 23 76 24 72C26 66 22 62 22 52C22 42 29 34 32 28Z"
          fill={`url(#li-${id})`}
          className="ls-fi"
          style={{
            animation: active ? "ls-bob 1.5s ease-in-out infinite" : "none",
            transformOrigin: "32px 88px",
          }}
        />

        {/* Hot core — bright inner tip, WordBlock's inset top-highlight */}
        <path
          d="M32 46C34 50 37 56 37 62C37 68 35 72 32 72C29 72 27 68 27 62C27 56 30 50 32 46Z"
          fill={active ? c.hot : c.light}
          opacity={active ? 0.9 : 0.3}
        />
      </svg>
    </div>
  );
};

export default StreakFlame;
