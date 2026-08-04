import { useEffect } from "react";

interface ShimmerEffectProps {
  show: boolean;
  message?: string;
  onComplete?: () => void;
}

export function ShimmerEffect({
  show,
  message = "Great effort!",
  onComplete,
}: ShimmerEffectProps) {
  useEffect(() => {
    if (!show) return;

    const timer = setTimeout(() => {
      onComplete?.();
    }, 1200);

    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
      <style>{`
        @keyframes shimmer-wave {
          0% {
            opacity: 0;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.2);
          }
        }

        @keyframes shimmer-text-pop {
          0% {
            opacity: 0;
            transform: scale(0.5) translateY(20px);
          }
          50% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1.1) translateY(-20px);
          }
        }
      `}</style>

      {/* Shimmer wave background */}
      <div
        className="absolute w-48 h-48 rounded-full bg-gradient-to-r from-amber-400 via-emerald-400 to-amber-400 blur-3xl"
        style={{
          animation: "shimmer-wave 1.2s ease-out",
          opacity: 0.3,
        }}
      />

      {/* Message */}
      <div
        className="relative text-center"
        style={{
          animation: "shimmer-text-pop 1.2s ease-out",
        }}
      >
        <p className="text-4xl font-black text-amber-300 drop-shadow-lg">{message}</p>
        <p className="text-sm text-amber-200 mt-2">Nice work!</p>
      </div>
    </div>
  );
}
