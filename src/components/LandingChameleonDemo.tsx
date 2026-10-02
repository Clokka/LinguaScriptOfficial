// "The mascot that turns green when you do" — interactive landing demo.
// Click the red words to save/review them (red→orange→green); the meter and
// the chameleon's colour track your progress using the real brand mascot
// (the same ChameleonMascot used everywhere else), not the legacy PNG/
// hue-rotate hack. At 100% the chameleon is simply green — the old gold/blue
// "hyper mode" state has been removed.
import { useMemo, useRef, useState } from "react";
import { useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";

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
  const tier: ChameleonTier = allGreen ? "green" : pct >= 40 ? "orange" : "red";

  const advance = (i: number) => {
    setWords((prev) =>
      prev.map((w, j) => {
        if (j !== i || w.fn) return w;
        return { ...w, state: (w.state === "red" ? "orange" : "green") as WordState };
      }),
    );
  };

  const reset = () => setWords(INITIAL);

  const wordColor: Record<WordState, string> = {
    red: "text-red-400",
    orange: "text-amber-400",
    green: "text-emerald-400/80",
  };

  return (
    <div ref={rootRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      {/* Chameleon stage */}
      <div className="relative mx-auto flex h-[320px] w-full max-w-[460px] items-center justify-center">
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-full blur-[70px] transition-all duration-700"
          style={{
            width: 280,
            height: 220,
            background: stateColor,
            opacity: 0.14 + (pct / 100) * 0.4,
            transform: `scale(${0.85 + (pct / 100) * 0.35})`,
          }}
        />
        {inView && (
          <div className="relative z-[2] w-[300px] max-w-full">
            <ChameleonMascot tier={tier} party={allGreen} />
          </div>
        )}
      </div>

      {/* Interactive panel — mirrors the concept */}
      <div className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl font-black tabular-nums transition-colors duration-500" style={{ color: stateColor }}>
            {pct}%
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            French understanding
          </span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary/50">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: stateColor }}
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
