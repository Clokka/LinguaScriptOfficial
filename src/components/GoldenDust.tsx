import { useEffect, useRef } from "react";
import gsap from "gsap";
import { GOLD } from "@/lib/goldenReveal";

/**
 * Golden dust drifting off the words that are waiting to be claimed.
 *
 * ONE canvas for the whole overlay, not one per word. A line can hold several
 * gold words, and a canvas each would mean several GL/2D contexts compositing
 * over video every frame — the single biggest way to make this feel cheap.
 * Callers hand it the on-screen rects and it draws them all.
 *
 * Driven by the GSAP ticker already in the project, so there's no second
 * animation loop and no new dependency.
 *
 * Under prefers-reduced-motion it renders nothing at all — the word still
 * shows gold and is still clickable, it just doesn't emit dust.
 */
export interface DustAnchor {
  /** Viewport-relative rect of the word to emit from. */
  rect: DOMRect;
  /** Stable id so particles survive re-renders of the same word. */
  key: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

/** Particles emitted per gold word. Tuned for "shimmer", not "smoke". */
const PER_WORD = 20;

export const GoldenDust = ({ anchors }: { anchors: DustAnchor[] }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const anchorsRef = useRef<DustAnchor[]>(anchors);
  anchorsRef.current = anchors;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pools = new Map<string, Particle[]>();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const spawn = (r: DOMRect): Particle => ({
      x: r.left + Math.random() * r.width,
      y: r.top + r.height * (0.3 + Math.random() * 0.7),
      vx: (Math.random() - 0.5) * 0.22,
      vy: -0.18 - Math.random() * 0.35,
      life: 0,
      maxLife: 900 + Math.random() * 900,
      size: 0.7 + Math.random() * 1.6,
    });

    let last = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(now - last, 48);
      last = now;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      const live = new Set(anchorsRef.current.map((a) => a.key));
      // Drop pools for words that are no longer gold (claimed, or line changed).
      for (const key of pools.keys()) if (!live.has(key)) pools.delete(key);

      // Additive blending is what makes gold read as light rather than paint
      // against dark video.
      ctx.globalCompositeOperation = "lighter";

      for (const anchor of anchorsRef.current) {
        let pool = pools.get(anchor.key);
        if (!pool) {
          pool = Array.from({ length: PER_WORD }, () => {
            const p = spawn(anchor.rect);
            // Stagger the initial lives so they don't pulse in unison.
            p.life = Math.random() * p.maxLife;
            return p;
          });
          pools.set(anchor.key, pool);
        }

        for (const p of pool) {
          p.life += dt;
          if (p.life >= p.maxLife) Object.assign(p, spawn(anchor.rect));

          p.x += p.vx * dt * 0.06;
          p.y += p.vy * dt * 0.06;

          const t = p.life / p.maxLife;
          // Fade in and out so particles never pop.
          const alpha = Math.sin(t * Math.PI) * 0.85;

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = t < 0.5 ? GOLD.core : GOLD.deep;
          ctx.globalAlpha = alpha;
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    };

    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
};

export default GoldenDust;
