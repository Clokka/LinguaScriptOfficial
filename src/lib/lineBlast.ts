import confetti from "canvas-confetti";

/**
 * The Line Blast — shared between the /landingpage4 demo and the real player.
 *
 * This file exists so the two cannot drift. The effect on the landing page is
 * the one people fall in love with; reimplementing it for the player would
 * guarantee it diverges within a couple of commits. Both surfaces import these
 * constants and primitives, so the XP, the praise wording and every timing are
 * identical by construction rather than by discipline.
 *
 * Nothing here is React — these operate on DOM elements, because the demo and
 * the subtitle overlay have different component trees but the same shapes:
 * a line element whose children are word spans, an absolutely-positioned FX
 * layer, and a confetti canvas.
 */

/** XP for a completed line, before the combo multiplier. */
export const BASE_XP = 15;

/** Combo stops climbing here; PRAISE is indexed by combo so they must match. */
export const COMBO_CAP = 5;

/** Indexed by combo (0 unused). Exact wording from the landing page demo. */
export const PRAISE: [string, string][] = [
  ["", ""],
  ["LINE COMPLETE!", ""],
  ["GREAT!", "combo ×2"],
  ["AMAZING!", "combo ×3"],
  ["INCREDIBLE!", "combo ×4"],
  ["UNBELIEVABLE!", "combo ×5"],
];

export const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** XP gained for a line at this combo. */
export const xpForCombo = (combo: number) => BASE_XP * combo;

/** The floating "+45 XP (15 × 3)" label. Format is part of the feel. */
export const floatXpText = (combo: number) =>
  `+${xpForCombo(combo)} XP${combo > 1 ? ` (${BASE_XP} × ${combo})` : ""}`;

/**
 * Sweep each word white → amber → green, staggered left to right.
 * This is the moment the line "turns", and it reads before the scatter.
 */
export function goldSweep(line: HTMLElement | null) {
  if (!line) return;
  Array.from(line.children).forEach((span, i) => {
    (span as HTMLElement).animate(
      [
        { color: "#f4f7f5" },
        { color: "#fbbf24", textShadow: "0 0 16px rgba(251,191,36,0.8)", offset: 0.4 },
        { color: "rgba(52,211,153,0.72)", textShadow: "none" },
      ],
      { duration: 460, delay: i * 30, easing: "ease-out", fill: "forwards" },
    );
  });
}

/**
 * Clone each word and fling it outward. Clones are used so the real line stays
 * in place underneath — the scatter is decoration, not a layout change.
 */
export function scatterClones(
  stage: HTMLElement | null,
  line: HTMLElement | null,
  fx: HTMLElement | null,
) {
  if (!stage || !line || !fx) return;
  const stageBox = stage.getBoundingClientRect();
  const fontSize = getComputedStyle(line).fontSize;

  Array.from(line.children).forEach((span) => {
    const b = span.getBoundingClientRect();
    const clone = document.createElement("span");
    clone.textContent = (span.textContent ?? "").trim();
    clone.className = "absolute font-extrabold text-amber-400 will-change-transform";
    clone.style.left = `${b.left - stageBox.left}px`;
    clone.style.top = `${b.top - stageBox.top}px`;
    clone.style.fontSize = fontSize;
    clone.style.textShadow = "0 0 18px rgba(251,191,36,0.65)";
    fx.appendChild(clone);

    const angle = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 190;
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist - 45; // slight upward bias
    const rot = (Math.random() * 2 - 1) * 200;

    clone
      .animate(
        [
          { transform: "translate(0,0) rotate(0deg) scale(1)", opacity: 1 },
          { transform: `translate(${dx}px,${dy}px) rotate(${rot}deg) scale(0.08)`, opacity: 0 },
        ],
        { duration: 560, easing: "cubic-bezier(0.16,1,0.3,1)", fill: "forwards" },
      )
      .addEventListener("finish", () => clone.remove());
  });
}

/** Particle count for a combo — capped so a long streak doesn't white out. */
export const confettiCountForCombo = (combo: number) =>
  Math.min(40 + combo * 30, 170);

/**
 * Confetti bound to a specific canvas so it composites inside the player
 * rather than over the whole page.
 */
export interface ConfettiBurst {
  fire: (count: number) => void;
  /** Clears in-flight particles — used when a surface unmounts mid-burst. */
  reset: () => void;
}

export function makeConfettiBurst(canvas: HTMLCanvasElement | null): ConfettiBurst {
  if (!canvas) return { fire: () => {}, reset: () => {} };
  const instance = confetti.create(canvas, { resize: true, useWorker: true });
  return {
    fire: (count: number) => {
      void instance({
        particleCount: count,
        spread: 80,
        startVelocity: 32,
        origin: { x: 0.5, y: 0.62 },
        colors: ["#34d399", "#fbbf24", "#6ee7b7", "#f4f7f5", "#a78bfa"],
        disableForReducedMotion: true,
      });
    },
    reset: () => instance.reset(),
  };
}
