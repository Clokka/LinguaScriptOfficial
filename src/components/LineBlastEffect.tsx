import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";

interface LineBlastEffectProps {
  show: boolean;
  xpGained: number;
  combo: number;
  onComplete?: () => void;
}

export function LineBlastEffect({
  show,
  xpGained,
  combo,
  onComplete,
}: LineBlastEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [particles, setParticles] = useState<any[]>([]);
  const animationFrameRef = useRef<number>();

  const PRAISE = [
    null,
    ["LINE COMPLETE!", ""],
    ["GREAT!", "combo ×2"],
    ["AMAZING!", "combo ×3"],
    ["INCREDIBLE!", "combo ×4"],
    ["UNBELIEVABLE!", "combo ×5"],
  ];

  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      triggerBlast();
    }, 100);

    return () => clearTimeout(timer);
  }, [show]);

  function triggerBlast() {
    if (!containerRef.current) return;

    // Confetti burst
    if (combo >= 2) {
      confetti({
        particleCount: Math.min(40 + combo * 30, 170),
        spread: 60,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#34d399", "#ffc53d", "#6ee7b7", "#f4f7f5", "#a78bfa"],
      });
    }

    // Show praise message
    const praiseData = PRAISE[Math.min(combo, 5)];
    if (praiseData) {
      const [big, sub] = praiseData;

      const praiseEl = document.createElement("div");
      praiseEl.className =
        "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-50";

      praiseEl.innerHTML = `
        <div class="text-center animate-praise">
          <p class="font-black italic text-white drop-shadow-lg" style="
            font-size: clamp(26px, ${4 + combo * 1.3}vw, ${44 + combo * 14}px);
            letter-spacing: -0.02em;
            transform: skewX(-6deg);
            color: #ffc53d;
            text-shadow: 0 2px 0 rgba(0,0,0,0.35), 0 0 34px rgba(255, 197, 61, 0.5);
          ">
            ${big}
          </p>
          <p class="font-bold text-xs uppercase mt-2 text-emerald-400" style="
            letter-spacing: 0.2em;
            text-shadow: 0 0 16px rgba(52, 211, 153, 0.6);
          ">
            ${sub}
          </p>
        </div>
      `;

      document.body.appendChild(praiseEl);

      setTimeout(() => {
        praiseEl.remove();
        onComplete?.();
      }, 1500);
    }

    // XP float
    const xpEl = document.createElement("div");
    xpEl.className =
      "fixed left-1/2 bottom-1/3 -translate-x-1/2 pointer-events-none z-50";

    xpEl.innerHTML = `
      <div class="font-bold text-lg text-emerald-400 animate-xp-rise" style="
        text-shadow: 0 0 14px rgba(52, 211, 153, 0.7);
        font-variant-numeric: tabular-nums;
      ">
        +${xpGained} XP ${combo > 1 ? `(15 × ${combo})` : ""}
      </div>
    `;

    document.body.appendChild(xpEl);

    setTimeout(() => {
      xpEl.remove();
    }, 1300);
  }

  return (
    <>
      <style>{`
        @keyframes praise-in {
          0%   { opacity: 0; transform: scale(0.4); }
          12%  { opacity: 1; transform: scale(1.12); }
          20%  { transform: scale(1); }
          78%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04) translateY(-14px); }
        }

        @keyframes xp-rise {
          0% { opacity: 0; transform: translateY(10px); }
          18% { opacity: 1; }
          75% { opacity: 1; }
          100% { opacity: 0; transform: translateY(-48px); }
        }

        .animate-praise {
          animation: praise-in 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .animate-xp-rise {
          animation: xp-rise 1.3s ease-out forwards;
        }
      `}</style>

      {show && <div ref={containerRef} className="fixed inset-0" />}
    </>
  );
}
