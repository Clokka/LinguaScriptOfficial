import { useEffect, useRef } from "react";
import gsap from "gsap";
import { cn } from "@/lib/utils";

/**
 * The streak flame — a particle fire on a canvas, sized to whatever it's given.
 *
 * It replaces a 24KB Lottie that was being stretched from 72px to 180px across
 * three call sites and desaturated with a CSS `grayscale` filter when the streak
 * was cold. A raster animation scaled that far, then filtered, is where the
 * "glitchy" look came from.
 *
 * The technique is deliberately the one already proven in GoldenDust: a canvas,
 * the GSAP ticker the project already runs, and additive blending so the warm
 * tones build into light rather than paint. That means the flame and the Golden
 * Reveal read as members of the same family, which a stock Lottie never could.
 *
 * Resolution-independent, a couple of KB, and no new dependency.
 */

interface Ember {
  /** 0..1 across the base of the flame. */
  x: number;
  /** 0 at the base, 1 at the tip. */
  y: number;
  vy: number;
  drift: number;
  seed: number;
  size: number;
}

interface StreakFlameProps {
  /** A cold streak burns low and blue-grey rather than being greyscaled. */
  active?: boolean;
  size?: number;
  className?: string;
}

const EMBERS = 42;

const spawn = (): Ember => ({
  x: 0.5 + (Math.random() - 0.5) * 0.34,
  y: Math.random(),
  vy: 0.55 + Math.random() * 0.75,
  drift: (Math.random() - 0.5) * 0.5,
  seed: Math.random() * Math.PI * 2,
  size: 0.05 + Math.random() * 0.09,
});

export const StreakFlame = ({ active = true, size = 96, className }: StreakFlameProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const embers = Array.from({ length: EMBERS }, spawn);
    let t = 0;

    const draw = () => {
      const lit = activeRef.current;
      ctx.clearRect(0, 0, size, size);
      ctx.globalCompositeOperation = "lighter";

      for (const e of embers) {
        if (!reduced) {
          e.y += (e.vy * 0.006) * (lit ? 1 : 0.45);
          if (e.y > 1) Object.assign(e, spawn(), { y: 0 });
        }

        // Narrow toward the tip so the silhouette reads as a flame rather than
        // a column of sparks.
        const taper = 1 - e.y * 0.72;
        const wobble = Math.sin(t * 0.9 + e.seed) * 0.06 * e.y;
        const px = (e.x - 0.5) * taper + 0.5 + wobble + e.drift * e.y * 0.12;
        const py = 1 - e.y;

        // Hot white-yellow at the base, deep orange at the tip. A cold streak
        // keeps the shape but drops to a dim slate-blue, which reads as "not
        // burning" far better than desaturating a full-colour animation.
        const heat = 1 - e.y;
        const r = lit ? 255 : 120;
        const g = lit ? Math.round(90 + heat * 150) : 140;
        const b = lit ? Math.round(20 + heat * 90) : 165;
        const alpha = Math.sin(Math.min(e.y, 1) * Math.PI) * (lit ? 0.85 : 0.35);

        const radius = e.size * size * taper;
        const grad = ctx.createRadialGradient(
          px * size, py * size, 0,
          px * size, py * size, Math.max(radius, 0.6),
        );
        grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
        grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px * size, py * size, Math.max(radius, 0.6), 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = "source-over";
      t += 0.016;
    };

    // Under reduced motion the flame is painted once and left alone: the shape
    // and the lit/cold state still communicate, without anything moving.
    if (reduced) {
      draw();
      return;
    }

    gsap.ticker.add(draw);
    return () => {
      gsap.ticker.remove(draw);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn("shrink-0 transition-opacity duration-500", className)}
      style={{ width: size, height: size }}
    />
  );
};

export default StreakFlame;
