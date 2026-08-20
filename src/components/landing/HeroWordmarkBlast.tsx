import { useCallback, useEffect, useRef, useState } from "react";
import {
  PRAISE,
  prefersReducedMotion,
  floatXpText,
  confettiCountForCombo,
  scatterClones,
  makeConfettiBurst,
  type ConfettiBurst,
} from "@/lib/lineBlast";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { Chameleon3D, type Chameleon3DTier } from "@/components/landing/Chameleon3D";
import { DECK, CELEBRATION_GOLD } from "@/lib/deck-colors";

/**
 * The hero: the wordmark IS the product.
 *
 * "Script" is the target. Tap it and it runs the real product arc — white,
 * then green, then gold, then the Line Blast fires — using the same
 * primitives as the player (`lib/lineBlast`, `LineBlastOverlay`) so the
 * marketing effect can never drift from the thing it is selling.
 *
 * The 3D chameleon shifts colour with the same beats, because on every other
 * surface in the app its colour IS the state of your words.
 */

type Phase = "idle" | "white" | "green" | "gold";

const PHASE_TIER: Record<Phase, Chameleon3DTier> = {
  idle: "red",
  white: "orange",
  green: "green",
  gold: "gold",
};

const PHASE_COLOR: Record<Phase, string> = {
  idle: "rgba(255,255,255,0.28)",
  white: "#FFFFFF",
  green: DECK.green,
  gold: CELEBRATION_GOLD,
};

export const HeroWordmarkBlast = ({ chameleonSize = 300 }: { chameleonSize?: number }) => {
  const [phase, setPhase] = useState<Phase>("idle");
  const [running, setRunning] = useState(false);
  const [combo, setCombo] = useState(0);
  const [praise, setPraise] = useState<{ big: string; sub: string; combo: number; key: number } | null>(null);
  const [floatXp, setFloatXp] = useState<{ text: string; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const scriptRef = useRef<HTMLSpanElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const burstRef = useRef<ConfettiBurst | null>(null);
  const timers = useRef<number[]>([]);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };

  useEffect(() => {
    burstRef.current = makeConfettiBurst(canvasRef.current);
    return () => {
      timers.current.forEach(clearTimeout);
      burstRef.current?.reset();
    };
  }, []);

  const fire = useCallback(() => {
    if (running) return;
    setRunning(true);

    const reduced = prefersReducedMotion();
    const nextCombo = Math.min(combo + 1, 5);
    setCombo(nextCombo);

    if (reduced) {
      setPhase("gold");
      later(() => {
        setPhase("green");
        setRunning(false);
      }, 900);
      return;
    }

    setPhase("white");
    later(() => setPhase("green"), 320);
    later(() => setPhase("gold"), 720);

    later(() => {
      scatterClones(stageRef.current, scriptRef.current, fxRef.current);
      burstRef.current?.fire(confettiCountForCombo(nextCombo));
      setGlowKey((k) => k + 1);
      const [big, sub] = PRAISE[nextCombo];
      setPraise({ big, sub, combo: nextCombo, key: Date.now() });
      setFloatXp({ text: floatXpText(nextCombo), key: Date.now() });
    }, 980);

    later(() => {
      setPhase("green");
      setRunning(false);
    }, 2100);
  }, [combo, running]);

  // Plays itself once for anyone who does not touch it.
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!prefersReducedMotion()) fire();
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scriptColor = PHASE_COLOR[phase];

  return (
    <div ref={stageRef} className="relative">
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full z-40"
      />
      <div ref={fxRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-40" />

      <div className="relative z-10 flex flex-col items-center">
        <h1 className="select-none text-center font-extrabold tracking-tight leading-[0.95] text-[clamp(3rem,13vw,9rem)]">
          <span className="text-white">Lingua</span>
          <span
            ref={scriptRef}
            role="button"
            tabIndex={0}
            aria-label="Tap Script to turn it green"
            onClick={fire}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fire();
              }
            }}
            data-cursor="hot"
            className="inline-block cursor-pointer align-baseline outline-none"
            style={{
              color: scriptColor,
              textShadow:
                phase === "gold"
                  ? `0 0 42px ${CELEBRATION_GOLD}80`
                  : phase === "green"
                    ? `0 0 32px ${DECK.green}55`
                    : "none",
              transition: "color .38s ease, text-shadow .38s ease, transform .38s ease",
              transform: phase === "gold" ? "scale(1.03)" : "scale(1)",
            }}
          >
            <span>Script</span>
          </span>
        </h1>

        <p className="mt-3 text-sm text-white/40">
          {running ? "There it goes." : "Tap Script. That is the whole app in one word."}
        </p>

        <div className="mt-6" data-cursor="hot">
          <Chameleon3D tier={PHASE_TIER[phase]} size={chameleonSize} />
        </div>
      </div>

      <LineBlastOverlay praise={praise} floatXp={floatXp} glowKey={glowKey} placement="stage" />
    </div>
  );
};

export default HeroWordmarkBlast;
