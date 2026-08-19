import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StreakFlame } from "@/components/StreakFlame";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePet } from "@/contexts/PetContext";

export interface StreakIgnitionDetail {
  streakCount: number;
  wordsReviewed: number;
  minutesWatched: number;
}

const EVENT = "linguascript:streak-ignited";

export function emitStreakIgnited(detail: StreakIgnitionDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StreakIgnitionDetail>(EVENT, { detail }));
}

/** Animated counter that ramps up from prev to target. */
const Counter = ({ from, to }: { from: number; to: number }) => {
  const [n, setN] = useState(from);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <>{n}</>;
};

/**
 * Cinematic, near-fullscreen streak celebration. Mount once at the app root;
 * it listens for the "linguascript:streak-ignited" event and plays.
 */
export const StreakCelebrationModal = () => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<StreakIgnitionDetail | null>(null);
  const { triggerReaction } = usePet();

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<StreakIgnitionDetail>).detail;
      setDetail(d);
      setOpen(true);
      triggerReaction("dance", 5000);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [triggerReaction]);

  // Auto-dismiss after a generous beat so it never blocks too long.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 7500);
    return () => clearTimeout(t);
  }, [open]);

  if (typeof document === "undefined") return null;

  const count = detail?.streakCount ?? 1;
  const prev = Math.max(0, count - 1);

  return createPortal(
    <AnimatePresence>
      {open && detail && (
        <motion.div
          key="celeb"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
        >
          {/* Dimmed cinematic backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Radial heat glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(249,115,22,0.35) 0%, rgba(99,102,241,0.18) 35%, transparent 65%)",
            }}
          />

          {/* Particle burst */}
          <Particles />

          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white/80"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content stack */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="relative z-10 flex flex-col items-center justify-center px-6 text-center w-full max-w-[680px]"
          >
            {/* Label */}
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Daily mission complete
            </motion.p>

            {/* Flame + overlaid streak number. The canvas scales to whatever
                size it is given, which the raster Lottie did not. */}
            <div className="relative mt-4 w-[min(78vw,460px)] h-[min(78vw,460px)] flex items-center justify-center">
              <StreakFlame active size={Math.min(window.innerWidth * 0.78, 460)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span
                  className="font-black tabular-nums leading-none"
                  style={{
                    fontSize: "clamp(80px, 22vw, 200px)",
                    color: "#FFF7ED",
                    textShadow:
                      "0 0 40px rgba(249,115,22,0.9), 0 0 90px rgba(249,115,22,0.55), 0 4px 12px rgba(0,0,0,0.55)",
                    WebkitTextStroke: "1px rgba(255,255,255,0.15)",
                  }}
                >
                  <Counter from={prev} to={count} />
                </span>
              </motion.div>
            </div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight text-white"
            >
              {count === 1 ? "Streak ignited" : `${count}-day streak!`}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-3 text-base sm:text-lg text-white/70 max-w-md"
            >
              You reviewed <b className="text-orange-300">{detail.wordsReviewed}</b> words and watched{" "}
              <b className="text-orange-300">{detail.minutesWatched}</b> min of French today. Compound it tomorrow.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
              className="mt-7"
            >
              <Button
                onClick={() => setOpen(false)}
                size="lg"
                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_10px_40px_-10px_rgba(249,115,22,0.7)] px-8"
              >
                Keep the fire alive
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

/** Lightweight particle burst — pure CSS/Framer, no canvas. */
const Particles = () => {
  const dots = Array.from({ length: 28 });
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const dist = 220 + Math.random() * 180;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const colors = ["#fb923c", "#f59e0b", "#fcd34d", "#a78bfa"];
        const color = colors[i % colors.length];
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x, y, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.6] }}
            transition={{ duration: 1.6 + Math.random() * 0.6, delay: 0.2, ease: "easeOut" }}
            className="absolute block rounded-full"
            style={{
              width: 6 + Math.random() * 6,
              height: 6 + Math.random() * 6,
              background: color,
              boxShadow: `0 0 16px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};
