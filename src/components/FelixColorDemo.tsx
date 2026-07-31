// Interactive Felix color-change demo — shows Felix transforming from red → orange → green
// as comprehension climbs. When sentence hits 100%, Felix spins + line blast fires:
// gold sweep, word scatter, praise ladder, XP count-up, confetti.
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

const PRAISE: [string, string][] = [
  ["", ""],
  ["LINE COMPLETE!", "Felix spins!"],
  ["GREAT!", ""],
  ["AMAZING!", ""],
  ["INCREDIBLE!", ""],
  ["UNBELIEVABLE!", ""],
];

export const FelixColorDemo = () => {
  const rootRef = useRef<HTMLDivElement>(null);
  const felixRef = useRef<PetLiveHandle>(null);
  const sentenceRef = useRef<HTMLParagraphElement>(null);
  const inView = useInView(rootRef, { once: true, margin: "120px" });
  const [words, setWords] = useState<Word[]>(INITIAL);
  const [locked, setLocked] = useState(false);
  const [praise, setPraise] = useState<{ big: string; sub: string; key: number } | null>(null);
  const wasComplete = useRef(false);

  const weight = (w: Word) => (w.fn ? 0.25 : 1);
  const pct = useMemo(() => {
    let known = 0, total = 0;
    for (const w of words) {
      total += weight(w);
      if (w.state === "green") known += weight(w);
    }
    return Math.round((known / total) * 100);
  }, [words]);

  const burstConfetti = useCallback(() => {
    // Rainbow confetti burst
    confetti({
      particleCount: 80,
      spread: 100,
      origin: { y: 0.6 },
      colors: ["#fbbf24", "#60a5fa", "#a78bfa", "#ec4899", "#f43f5e"],
      shapes: ["star"],
      disableForReducedMotion: true,
    });
    // Gold sparkle wave
    setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.5 },
        colors: ["#fcd34d", "#fbbf24"],
        gravity: 0.8,
        disableForReducedMotion: true,
      });
    }, 100);
  }, []);

  const fireBlast = useCallback(() => {
    if (locked) return;
    setLocked(true);
    felixRef.current?.play("Spin");
    setTimeout(() => {
      setPraise({ big: "🌟 ASCENSION 🌟", sub: "Felix reaches enlightenment!", key: Date.now() });
      burstConfetti();
    }, 200);
    setTimeout(() => {
      setLocked(false);
    }, 3500);
  }, [locked, burstConfetti]);

  const advance = (i: number) => {
    if (locked) return;
    setWords((prev) => {
      const next = prev.map((w, j) => {
        if (j !== i || w.fn) return w;
        return { ...w, state: (w.state === "red" ? "orange" : "green") as WordState };
      });
      if (!wasComplete.current && Math.round((Object.values(next).filter(w => w.state === "green").length / next.length) * 100) === 100) {
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
        @keyframes fx-praise {
          0% { opacity: 0; transform: scale(0.4); }
          10% { opacity: 1; transform: scale(1.1); }
          20% { transform: scale(1); }
          80% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.05) translateY(-20px); }
        }
        @keyframes fx-ascension-text {
          0% { opacity: 0; transform: scale(0.3) rotateZ(-10deg); }
          15% { opacity: 1; transform: scale(1.15) rotateZ(0deg); }
          25% { transform: scale(1); }
          85% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.08) translateY(-30px) rotateZ(5deg); }
        }
        @keyframes fx-gold-sweep {
          from { width: 0%; background: linear-gradient(90deg, transparent, #fbbf24, transparent); }
          to { width: 100%; background: transparent; }
        }
        @keyframes fx-aurora-glow {
          0% { opacity: 0; box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.8); }
          20% { opacity: 1; box-shadow: 0 0 40px 20px rgba(251, 191, 36, 0.4); }
          50% { box-shadow: 0 0 60px 30px rgba(96, 165, 250, 0.3), inset 0 0 40px rgba(167, 139, 250, 0.2); }
          100% { opacity: 0; box-shadow: 0 0 20px 40px rgba(251, 191, 36, 0); }
        }
        @keyframes fx-scale-pulse {
          0% { transform: scale(1); }
          20% { transform: scale(1.08); }
          40% { transform: scale(0.98); }
          60% { transform: scale(1.04); }
          80% { transform: scale(1); }
          100% { transform: scale(1); }
        }
        @keyframes fx-rainbow-shimmer {
          0% { background: radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(96,165,250,0.2) 33%, rgba(167,139,250,0.2) 66%, transparent 100%); }
          25% { background: radial-gradient(circle, rgba(96,165,250,0.4) 0%, rgba(167,139,250,0.2) 33%, rgba(236,72,153,0.2) 66%, transparent 100%); }
          50% { background: radial-gradient(circle, rgba(167,139,250,0.4) 0%, rgba(236,72,153,0.2) 33%, rgba(244,63,94,0.2) 66%, transparent 100%); }
          75% { background: radial-gradient(circle, rgba(34,211,153,0.4) 0%, rgba(251,191,36,0.2) 33%, rgba(96,165,250,0.2) 66%, transparent 100%); }
          100% { background: radial-gradient(circle, rgba(251,191,36,0.4) 0%, rgba(96,165,250,0.2) 33%, rgba(167,139,250,0.2) 66%, transparent 100%); }
        }
      `}</style>

      {/* Felix 3D model — color-changing + ascension effects */}
      <div
        className="relative mx-auto flex h-[320px] w-full max-w-[460px] items-center justify-center"
        style={
          praise
            ? {
                animation: "fx-scale-pulse 1s ease-out, fx-aurora-glow 1.2s ease-out forwards",
              }
            : undefined
        }
      >
        {/* Aurora shimmer overlay */}
        {praise && (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ animation: "fx-rainbow-shimmer 1.2s ease-out forwards" }}
          />
        )}

        {/* Ascension praise text */}
        {praise && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              key={`praise-${praise.key}`}
              className="text-center"
              style={{ animation: "fx-ascension-text 1.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards" }}
            >
              <div className="text-5xl font-black bg-gradient-to-r from-amber-300 via-pink-300 to-blue-300 bg-clip-text text-transparent drop-shadow-lg">
                {praise.big}
              </div>
              {praise.sub && (
                <div className="text-sm font-bold text-amber-200 mt-2 drop-shadow-md">{praise.sub}</div>
              )}
            </div>
          </div>
        )}

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

        <div className="relative">
          {pct === 100 && (
            <div
              className="absolute inset-0 pointer-events-none rounded"
              style={{ animation: "fx-gold-sweep 0.6s ease-out forwards" }}
            />
          )}
          <p ref={sentenceRef} className="text-2xl font-semibold leading-relaxed">
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
        </div>

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
