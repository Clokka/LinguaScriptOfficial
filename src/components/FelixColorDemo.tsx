// Interactive Felix color-change demo with LineBlast-style celebration
import { useCallback, useMemo, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import confetti from "canvas-confetti";
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

// Same praise ladder as LineBlastDemo
const PRAISE: [string, string][] = [
  ["", ""],
  ["LINE COMPLETE!", ""],
  ["GREAT!", ""],
  ["AMAZING!", ""],
  ["INCREDIBLE!", ""],
  ["UNBELIEVABLE!", ""],
];

export const FelixColorDemo = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const felixRef = useRef<PetLiveHandle>(null);
  const inView = useInView(rootRef, { once: true, margin: "120px" });
  const [words, setWords] = useState<Word[]>(INITIAL);
  const [locked, setLocked] = useState(false);
  const [praise, setPraise] = useState<{ big: string; sub: string; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const wasComplete = useRef(false);

  const weight = (w: Word) => (w.fn ? 0.25 : 1);
  const pct = useMemo(() => {
    let known = 0,
      total = 0;
    for (const w of words) {
      total += weight(w);
      if (w.state === "green") known += weight(w);
    }
    return Math.round((known / total) * 100);
  }, [words]);

  const burstConfetti = useCallback(() => {
    confetti({
      particleCount: 100,
      spread: 90,
      origin: { y: 0.5 },
      colors: ["#34d399", "#fbbf24", "#60a5fa", "#ec4899"],
      disableForReducedMotion: true,
    });
  }, []);

  const fireBlast = useCallback(() => {
    if (locked) return;
    setLocked(true);
    felixRef.current?.play("Spin");

    // Use combo level (always 1 for this demo)
    const comboLevel = 1;
    const [big, sub] = PRAISE[comboLevel];

    setTimeout(() => {
      setPraise({ big, sub, key: Date.now() });
      burstConfetti();
      setGlowKey(Date.now());
    }, 200);

    setTimeout(() => {
      setLocked(false);
    }, 2800);
  }, [locked, burstConfetti]);

  const advance = (i: number) => {
    if (locked) return;
    setWords((prev) => {
      const next = prev.map((w, j) => {
        if (j !== i || w.fn) return w;
        return { ...w, state: (w.state === "red" ? "orange" : "green") as WordState };
      });

      // Check if complete
      let known = 0,
        total = 0;
      for (const w of next) {
        total += weight(w);
        if (w.state === "green") known += weight(w);
      }
      const newPct = Math.round((known / total) * 100);

      if (!wasComplete.current && newPct === 100) {
        wasComplete.current = true;
        fireBlast();
      }

      return next;
    });
  };

  const reset = () => {
    setWords(INITIAL);
    setPraise(null);
    setLocked(false);
    setGlowKey(0);
    wasComplete.current = false;
  };

  const wordColor: Record<WordState, string> = {
    red: "text-red-400",
    orange: "text-amber-400",
    green: "text-emerald-400/80",
  };

  return (
    <div ref={rootRef} className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
      <style>{`
        @keyframes lb-praise-in {
          0% { opacity: 0; transform: scale(0.4); }
          12% { opacity: 1; transform: scale(1.12); }
          20% { transform: scale(1); }
          78% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04) translateY(-14px); }
        }
        @keyframes lb-gold-sweep {
          from { width: 0%; background: linear-gradient(90deg, transparent, #fbbf24, transparent); }
          to { width: 100%; background: transparent; }
        }
        @keyframes lb-glow {
          0% { opacity: 0; }
          22% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>

      {/* Felix 3D model — stays visible */}
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

        {/* Praise text overlay (stays on top) */}
        {praise && praise.big && (
          <div
            key={`praise-${praise.key}`}
            className="pointer-events-none absolute inset-0 flex items-center justify-center"
            style={{ animation: "lb-praise-in 1s ease-out forwards" }}
          >
            <div className="text-center">
              <div className="text-5xl font-black text-amber-300">{praise.big}</div>
              {praise.sub && <div className="text-sm font-bold text-amber-200 mt-2">{praise.sub}</div>}
            </div>
          </div>
        )}

        {/* Edge glow */}
        {glowKey > 0 && (
          <div
            key={`glow-${glowKey}`}
            className="pointer-events-none absolute inset-0 z-[35] rounded-2xl opacity-0 [box-shadow:inset_0_0_90px_rgba(52,211,153,0.55)]"
            style={{ animation: "lb-glow 0.9s ease-out forwards" }}
          />
        )}
      </div>

      {/* Interactive panel */}
      <div className="rounded-2xl border border-border/60 bg-background/40 p-6 backdrop-blur">
        <div className="mb-4 flex items-center gap-3">
          <span className="text-3xl font-black tabular-nums text-emerald-400">{pct}%</span>
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            French understanding
          </span>
        </div>
        <div className="mb-5 h-2 overflow-hidden rounded-full bg-secondary/50">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: pct === 100 ? "linear-gradient(90deg,#fcd34d,#60a5fa)" : "#34d399" }}
          />
        </div>

        {/* Gold sweep on complete */}
        {pct === 100 && (
          <div
            className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent"
            style={{ animation: "lb-gold-sweep 0.6s ease-out forwards", top: "100px" }}
          />
        )}

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
          Click a <span className="font-semibold text-red-400">red word</span> to save it, click again as it's
          reviewed. When the sentence turns green, Felix celebrates!
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
