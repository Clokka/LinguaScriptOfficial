// "The mascot that turns green when you do" — rebuild of the chameleon
// concept as an interactive landing demo. Click the red words to save/review
// them (red→orange→green); the comprehension meter and the 3D chameleon's
// colour track your progress. Hit 100% and the chameleon flips into a
// gold/blue "god mode" hyper state.
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { PetLive, PetLiveHandle, MascotTint } from "@/components/pets/PetLive";
import { cn } from "@/lib/utils";

const MASCOT_GLB = "/pets/Gecko_Animations.glb";

type WordState = "green" | "red" | "orange";
interface Word {
  t: string;
  fn?: boolean; // function word — always green, low weight
  state: WordState;
}

// "Je voudrais apprendre davantage avec toi" — matches the concept sentence.
const INITIAL: Word[] = [
  { t: "Je", fn: true, state: "green" },
  { t: "voudrais", state: "red" },
  { t: "apprendre", state: "red" },
  { t: "davantage", state: "red" },
  { t: "avec", fn: true, state: "green" },
  { t: "toi", state: "red" },
];

const RED = "#ef4444";
const ORANGE = "#fb923c";
const GREEN = "#34d399";

const hexToRgb = (h: string) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lerpHex = (a: string, b: string, t: number) => {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t);
};
// Comprehension % → a colour on the red→orange→green ramp.
const rampColor = (pct: number) =>
  pct < 50 ? lerpHex(RED, ORANGE, pct / 50) : lerpHex(ORANGE, GREEN, (pct - 50) / 50);

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const LandingChameleonDemo = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<PetLiveHandle>(null);
  const inView = useInView(rootRef, { once: true, margin: "120px" });
  const [ready, setReady] = useState(false);
  const [words, setWords] = useState<Word[]>(INITIAL);
  const [god, setGod] = useState(false);
  const godTimer = useRef<number>(0);

  const weight = (w: Word) => (w.fn ? 0.25 : 1);
  const pct = useMemo(() => {
    let known = 0;
    let total = 0;
    for (const w of words) {
      total += weight(w);
      if (w.state === "green") known += weight(w);
    }
    return Math.round((known / total) * 100);
  }, [words]);

  const allGreen = pct === 100;

  // Fire god mode once everything is green, then settle back to green.
  useEffect(() => {
    if (!allGreen) return;
    liveRef.current?.play("Spin");
    setGod(true);
    clearTimeout(godTimer.current);
    godTimer.current = window.setTimeout(() => setGod(false), 2600);
    return () => clearTimeout(godTimer.current);
  }, [allGreen]);

  const stateColor = allGreen ? GREEN : rampColor(pct);

  const tint: MascotTint = god
    ? { color: GREEN, god: true }
    : {
        color: stateColor,
        emissive: stateColor,
        emissiveIntensity: 0.25 + (pct / 100) * 0.35,
      };

  const advance = (i: number) => {
    setWords((prev) =>
      prev.map((w, j) => {
        if (j !== i || w.fn) return w;
        const next: WordState = w.state === "red" ? "orange" : "green";
        return { ...w, state: next };
      }),
    );
    if (!prefersReducedMotion()) liveRef.current?.play("Clicked");
  };

  const reset = () => {
    setGod(false);
    setWords(INITIAL);
  };

  const wordColor: Record<WordState, string> = {
    red: "text-red-400",
    orange: "text-amber-400",
    green: "text-emerald-400/80",
  };

  return (
    <div ref={rootRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      {/* Chameleon stage */}
      <div className="relative mx-auto flex h-[340px] w-full max-w-[440px] items-center justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full blur-[70px] transition-all duration-700"
          style={{
            width: 260,
            height: 260,
            background: god ? "#7dd3fc" : stateColor,
            opacity: god ? 0.75 : 0.18 + (pct / 100) * 0.5,
            transform: `scale(${god ? 1.35 : 0.85 + (pct / 100) * 0.4})`,
          }}
        />
        {!ready && (
          <span className="absolute text-7xl opacity-40" aria-hidden>
            🦎
          </span>
        )}
        {inView && (
          <div className={cn("relative transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}>
            <PetLive ref={liveRef} glbFile={MASCOT_GLB} size={320} tint={tint} onReady={() => setReady(true)} />
          </div>
        )}
        {god && (
          <div className="pointer-events-none absolute -top-1 rounded-full border border-amber-300/60 bg-black/50 px-3 py-1 text-xs font-black tracking-wide text-amber-300 backdrop-blur">
            ✦ HYPER MODE ✦
          </div>
        )}
      </div>

      {/* Interactive panel — mirrors the concept */}
      <div className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="text-3xl font-black tabular-nums transition-colors duration-500"
            style={{ color: god ? "#fcd34d" : stateColor }}
          >
            {pct}%
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            French understanding
          </span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary/50">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: god ? "linear-gradient(90deg,#fcd34d,#60a5fa)" : stateColor }}
          />
        </div>

        <p className="text-2xl font-semibold leading-relaxed">
          {words.map((w, i) => (
            <span
              key={i}
              role={w.fn ? undefined : "button"}
              tabIndex={w.fn || w.state === "green" ? undefined : 0}
              onClick={() => advance(i)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !w.fn) {
                  e.preventDefault();
                  advance(i);
                }
              }}
              className={cn(
                "inline-block whitespace-pre transition-colors duration-500",
                wordColor[w.state],
                !w.fn && w.state !== "green" && "cursor-pointer rounded hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400",
              )}
            >
              {w.t}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Click a <span className="font-semibold text-red-400">red word</span> to save it, click
          again as it's reviewed. When the sentence turns green, so does the chameleon.
        </p>

        {allGreen && (
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-full border border-border bg-secondary/40 px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-secondary/70"
          >
            ↺ Try again
          </button>
        )}
      </div>
    </div>
  );
};
