// Landing-page prototype of the "Line Blast" concept: completing a subtitle
// line (100% green) fires a Block Blast-style celebration — gold sweep,
// word-scatter, combo multipliers, XP count-up. Self-contained demo with
// hardcoded lines; the in-app version is planned separately
// (docs/plans/line-blast-completion-effects.md).
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BASE_XP,
  COMBO_CAP,
  PRAISE,
  prefersReducedMotion,
  xpForCombo,
  floatXpText,
  confettiCountForCombo,
  goldSweep as sharedGoldSweep,
  scatterClones as sharedScatterClones,
  makeConfettiBurst,
  type ConfettiBurst,
} from "@/lib/lineBlast";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { cn } from "@/lib/utils";

// Mirrors the weighted scoring in src/lib/understanding.ts
const FN_FR = new Set(
  ("le la les l un une des de du d au aux à a et ou mais que qui je tu il elle on nous vous ils elles me te se lui " +
    "ce cet cette ces mon ma mes ton ta tes son sa ses est sont ne n pas si oui non plus très bien pour par sur " +
    "sous dans avec sans comme moi s y en").split(" "),
);
const norm = (t: string) => t.toLowerCase().replace(/[.,!?;:'’«»]/g, "").trim();
const weightOf = (t: string) => (FN_FR.has(norm(t)) ? 0.25 : 1);

interface DemoLine {
  text: string;
  tr: string;
  unknown: string[]; // words that start white — 1–3 taps from the blast
}

const LINES: DemoLine[] = [
  { text: "Je voudrais un café noir, s'il vous plaît", tr: "I would like a black coffee, please", unknown: ["voudrais", "noir"] },
  { text: "Elle regarde la pluie tomber sur la ville", tr: "She watches the rain fall on the city", unknown: ["pluie", "tomber"] },
  { text: "Nous allons au marché demain matin", tr: "We are going to the market tomorrow morning", unknown: ["marché"] },
  { text: "Le vieux monsieur lit son journal près de la fenêtre", tr: "The old man reads his newspaper by the window", unknown: ["journal", "fenêtre", "lit"] },
  { text: "Tu veux marcher avec moi ce soir ?", tr: "Do you want to walk with me tonight?", unknown: ["marcher", "soir"] },
  { text: "La musique douce remplit la petite salle", tr: "The soft music fills the little room", unknown: ["remplit", "douce"] },
];


interface WordState {
  text: string;
  weight: number;
  green: boolean;
}

const buildWords = (line: DemoLine): WordState[] => {
  const unknown = new Set(line.unknown.map(norm));
  return line.text.split(" ").map((text) => ({
    text,
    weight: weightOf(text),
    green: !unknown.has(norm(text)),
  }));
};

const scoreOf = (words: WordState[]) => {
  let known = 0;
  let total = 0;
  for (const w of words) {
    total += w.weight;
    if (w.green) known += w.weight;
  }
  return total ? Math.round((known / total) * 100) : 0;
};

export const LineBlastDemo = ({ className }: { className?: string }) => {
  const [lineIdx, setLineIdx] = useState(0);
  const [words, setWords] = useState<WordState[]>(() => buildWords(LINES[0]));
  const [locked, setLocked] = useState(false);
  const [combo, setCombo] = useState(0);
  const [xpShown, setXpShown] = useState(0);
  const [praise, setPraise] = useState<{ big: string; sub: string; combo: number; key: number } | null>(null);
  const [floatXp, setFloatXp] = useState<{ text: string; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const [entering, setEntering] = useState(true);

  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<ConfettiBurst | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const xpRafRef = useRef<number>(0);
  const xpRef = useRef(0); // true XP total
  const xpShownRef = useRef(0); // value currently displayed by the count-up

  const later = useCallback((fn: () => void, ms: number) => {
    timeoutsRef.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(
    () => () => {
      timeoutsRef.current.forEach(clearTimeout);
      cancelAnimationFrame(xpRafRef.current);
      confettiRef.current?.reset();
    },
    [],
  );

  const pct = scoreOf(words);

  const loadLine = useCallback((idx: number) => {
    const next = ((idx % LINES.length) + LINES.length) % LINES.length;
    setLineIdx(next);
    setWords(buildWords(LINES[next]));
    setLocked(false);
    setEntering(true);
  }, []);

  useEffect(() => {
    if (!entering) return;
    const t = window.setTimeout(() => setEntering(false), 350);
    return () => clearTimeout(t);
  }, [entering]);

  const countUpXp = useCallback((to: number) => {
    cancelAnimationFrame(xpRafRef.current);
    const base = xpShownRef.current;
    const start = performance.now();
    const dur = 550;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(base + (to - base) * eased);
      xpShownRef.current = v;
      setXpShown(v);
      if (p < 1) xpRafRef.current = requestAnimationFrame(tick);
    };
    xpRafRef.current = requestAnimationFrame(tick);
  }, []);

  const scatterClones = useCallback(() => {
    sharedScatterClones(stageRef.current, lineRef.current, fxRef.current);
  }, []);

  const goldSweep = useCallback(() => {
    sharedGoldSweep(lineRef.current);
  }, []);

  const burstConfetti = useCallback((count: number) => {
    if (!confettiRef.current) {
      confettiRef.current = makeConfettiBurst(canvasRef.current);
    }
    confettiRef.current.fire(count);
  }, []);

  const blast = useCallback(
    (comboNow: number) => {
      const reduced = prefersReducedMotion();
      const gained = xpForCombo(comboNow);
      if (!reduced) goldSweep();
      later(() => {
        if (!reduced) scatterClones();
        const [big, sub] = PRAISE[comboNow];
        setPraise({ big, sub, combo: comboNow, key: Date.now() });
        setFloatXp({ text: floatXpText(comboNow), key: Date.now() });
        xpRef.current += gained;
        countUpXp(xpRef.current);
        if (comboNow >= 2 && !reduced) {
          burstConfetti(confettiCountForCombo(comboNow));
          setGlowKey(Date.now());
        }
      }, reduced ? 0 : 220);
      later(() => loadLine(lineIdx + 1), reduced ? 1500 : 2100);
    },
    [burstConfetti, countUpXp, goldSweep, later, lineIdx, loadLine, scatterClones],
  );

  const markKnown = (i: number) => {
    if (locked || words[i].green) return;
    const next = words.map((w, j) => (j === i ? { ...w, green: true } : w));
    setWords(next);
    if (scoreOf(next) === 100) {
      setLocked(true);
      const comboNow = Math.min(combo + 1, COMBO_CAP);
      setCombo(comboNow);
      blast(comboNow);
    }
  };

  const previewFullCombo = () => {
    if (locked) return;
    setLocked(true);
    setWords((prev) => prev.map((w) => ({ ...w, green: true })));
    setCombo(COMBO_CAP);
    blast(COMBO_CAP);
  };

  const line = LINES[lineIdx];

  return (
    <div className={cn("select-none", className)}>
      {/* The praise / XP / glow keyframes now live in LineBlastOverlay, which
          every surface shares. Only the demo's own line-entry animation is
          local to this component. */}
      <style>{`
        @keyframes lb-line-in {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lb-entering { animation: none !important; }
        }
      `}</style>

      <div
        ref={stageRef}
        className="relative aspect-video max-h-[520px] w-full overflow-hidden rounded-2xl border border-border/60 bg-[#101917]"
      >
        {/* Fake film frame */}
        <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(60%_80%_at_20%_30%,#1d3a33_0%,transparent_60%),radial-gradient(50%_70%_at_80%_60%,#26212f_0%,transparent_60%),linear-gradient(160deg,#131c1a_0%,#0c1412_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_40%,transparent_55%,rgba(0,0,0,0.55)_100%)]" />
        <span className="absolute left-4 top-3.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">
          Un café près de la Seine · 12:04
        </span>

        {/* HUD */}
        <div className="absolute right-3 top-3 z-30 flex items-center gap-2">
          {combo > 0 && (
            <div
              className={cn(
                "flex items-center rounded-full border bg-black/45 px-3 py-1 text-[11px] font-extrabold tracking-wide backdrop-blur",
                combo >= 3 ? "border-emerald-400/60 text-emerald-300" : "border-white/15 text-white",
                combo >= 2 && "animate-pulse",
              )}
            >
              COMBO ×{combo}
            </div>
          )}
          <div className="rounded-full border border-white/15 bg-black/45 px-3.5 py-1 text-sm font-extrabold tabular-nums text-white backdrop-blur">
            {xpShown.toLocaleString()}
            <span className="ml-1 text-[10px] font-bold text-white/50">XP</span>
          </div>
        </div>

        {/* Subtitle panel */}
        <div className="absolute inset-x-0 bottom-[8%] z-20 flex justify-center px-[4%]">
          <div className="relative max-w-[640px] rounded-2xl border border-white/15 bg-[rgba(8,12,11,0.62)] px-6 py-4 text-center backdrop-blur-xl sm:px-8">
            <span
              className={cn(
                "absolute -top-3 right-4 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-extrabold tabular-nums text-emerald-300 backdrop-blur transition-transform",
                pct === 100 && "scale-110 bg-emerald-500/30",
              )}
            >
              {pct}% green
            </span>
            <span className="absolute -top-3 left-4 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/60 backdrop-blur">
              tap a white word
            </span>
            <p
              ref={lineRef}
              className={cn("m-0 text-lg font-medium leading-relaxed sm:text-2xl", entering && "lb-entering")}
              style={entering ? { animation: "lb-line-in 320ms cubic-bezier(0.16,1,0.3,1)" } : undefined}
            >
              {words.map((w, i) => (
                <span
                  key={`${lineIdx}-${i}`}
                  role={w.green ? undefined : "button"}
                  tabIndex={w.green ? undefined : 0}
                  onClick={() => markKnown(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      markKnown(i);
                    }
                  }}
                  className={cn(
                    "inline-block whitespace-pre rounded transition-colors",
                    w.green
                      ? "font-medium text-emerald-400/70"
                      : "cursor-pointer font-semibold text-white hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400",
                  )}
                >
                  {w.text}
                  {i < words.length - 1 ? " " : ""}
                </span>
              ))}
            </p>
            <p className="mb-0 mt-1.5 text-xs font-light text-white/45 sm:text-sm">{line.tr}</p>
          </div>
        </div>

        {/* FX layers */}
        <div ref={fxRef} className="pointer-events-none absolute inset-0 z-40" />
        <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[45] h-full w-full" />

        {/* Praise, floating XP and the combo glow — shared with the player and
            the LinguaScript session so all three stay identical. */}
        <LineBlastOverlay
          praise={praise}
          floatXp={floatXp}
          glowKey={glowKey}
          placement="stage"
        />
      </div>

      {/* Demo controls */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (locked) return;
            loadLine(lineIdx + 1);
          }}
          className="rounded-full border border-border bg-secondary/40 px-5 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          Skip line →
        </button>
        <button
          type="button"
          onClick={previewFullCombo}
          className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-5 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
        >
          Show me full combo ⚡
        </button>
      </div>
    </div>
  );
};
