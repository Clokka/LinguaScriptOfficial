// "The mascot that turns green when you do" — interactive landing demo using
// the original flat chameleon illustration. Click the red words to save/review
// them (red→orange→green); the meter and the chameleon's colour (via CSS
// hue-rotate) track your progress. Hit 100% for a gold/blue hyper state.
import { useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";

type WordState = "green" | "red" | "orange";
interface Word {
  t: string;
  fn?: boolean;
  state: WordState;
}

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

const hexToRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgbToHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
const lerpHex = (a: string, b: string, t: number) => {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
};
const rampColor = (pct: number) =>
  pct < 50 ? lerpHex(RED, ORANGE, pct / 50) : lerpHex(ORANGE, GREEN, (pct - 50) / 50);

export const LandingChameleonDemo = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "120px" });
  const [words, setWords] = useState<Word[]>(INITIAL);
  const [god, setGod] = useState(false);
  const godTimer = useRef<number>(0);

  const weight = (w: Word) => (w.fn ? 0.25 : 1);
  const pct = useMemo(() => {
    let known = 0, total = 0;
    for (const w of words) {
      total += weight(w);
      if (w.state === "green") known += weight(w);
    }
    return Math.round((known / total) * 100);
  }, [words]);

  const allGreen = pct === 100;
  const stateColor = allGreen ? GREEN : rampColor(pct);

  // The illustration is orange (~25°). Rotate hue from red (0%) to green (100%).
  const skinFilter = god
    ? "hue-rotate(18deg) saturate(1.7) brightness(1.15) drop-shadow(0 0 26px rgba(59,130,246,0.9))"
    : `hue-rotate(${-25 + (pct / 100) * 120}deg) saturate(${1 + (pct / 100) * 0.25})`;

  const advance = (i: number) => {
    setWords((prev) => {
      const next = prev.map((w, j) => {
        if (j !== i || w.fn) return w;
        return { ...w, state: (w.state === "red" ? "orange" : "green") as WordState };
      });
      const full = next.every((w) => w.state === "green");
      if (full && !god) {
        setGod(true);
        clearTimeout(godTimer.current);
        godTimer.current = window.setTimeout(() => setGod(false), 2600);
      }
      return next;
    });
  };

  const reset = () => {
    setGod(false);
    clearTimeout(godTimer.current);
    setWords(INITIAL);
  };

  const wordColor: Record<WordState, string> = {
    red: "text-red-400",
    orange: "text-amber-400",
    green: "text-emerald-400/80",
  };

  return (
    <div ref={rootRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      <style>{`
        @keyframes cham-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @media (prefers-reduced-motion: reduce){ .cham-bob{ animation:none !important } }
      `}</style>

      {/* Chameleon stage */}
      <div className="relative mx-auto flex h-[320px] w-full max-w-[460px] items-center justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full blur-[70px] transition-all duration-700"
          style={{
            width: 280,
            height: 220,
            background: god ? "#7dd3fc" : stateColor,
            opacity: god ? 0.7 : 0.14 + (pct / 100) * 0.4,
            transform: `scale(${god ? 1.3 : 0.85 + (pct / 100) * 0.35})`,
          }}
        />
        {god && (
          <div className="pointer-events-none absolute top-1 z-10 rounded-full border border-amber-300/60 bg-black/50 px-3 py-1 text-xs font-black tracking-wide text-amber-300 backdrop-blur">
            ✦ HYPER MODE ✦
          </div>
        )}
        {inView && (
          <img
            src="/mascot/chameleon.png"
            alt="LinguaScript chameleon mascot"
            className="cham-bob relative z-[2] w-[360px] max-w-full transition-[filter] duration-500"
            style={{ filter: skinFilter, animation: "cham-bob 4s ease-in-out infinite" }}
            draggable={false}
          />
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
