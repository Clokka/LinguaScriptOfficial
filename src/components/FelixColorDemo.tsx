// Interactive Felix color-change demo — shows Felix transforming from red → orange → green
// as comprehension climbs, mirroring the chameleon illustration beside it.
import { useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { cn } from "@/lib/utils";
import { PetLive, PetLiveHandle } from "@/components/pets/PetLive";

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

export const FelixColorDemo = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const felixRef = useRef<PetLiveHandle>(null);
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

  const advance = (i: number) => {
    setWords((prev) => {
      const next = prev.map((w, j) => {
        if (j !== i || w.fn) return w;
        return { ...w, state: (w.state === "red" ? "orange" : "green") as WordState };
      });
      return next;
    });
  };

  const reset = () => setWords(INITIAL);

  const wordColor: Record<WordState, string> = {
    red: "text-red-400",
    orange: "text-amber-400",
    green: "text-emerald-400/80",
  };

  return (
    <div ref={rootRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      {/* Felix 3D model — color-changing */}
      <div className="relative mx-auto flex h-[320px] w-full max-w-[460px] items-center justify-center">
        {inView && (
          <PetLive
            ref={felixRef}
            glbFile="/pets/Chameleon_Animations.glb"
            size={280}
            comprehensionPercent={pct}
            idleClip="Idle_A"
          />
        )}
      </div>

      {/* Interactive panel */}
      <div className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl font-black tabular-nums text-emerald-400">
            {pct}%
          </span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            French understanding
          </span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary/50">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-500"
            style={{ width: `${pct}%` }}
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
          again as it's reviewed. Watch Felix change colors from red to green as you learn!
        </p>

        {pct === 100 && (
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
