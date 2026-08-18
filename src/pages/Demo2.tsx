// /demo2 — Line Blast demo where words phase red → orange → green on each tap,
// with a ChameleonMascot that changes colour as the line fills with green.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  COMBO_CAP,
  PRAISE,
  prefersReducedMotion,
  xpForCombo,
  floatXpText,
  goldSweep as sharedGoldSweep,
  scatterClones as sharedScatterClones,
  type ConfettiBurst,
  makeConfettiBurst,
  confettiCountForCombo,
} from "@/lib/lineBlast";
import { cn } from "@/lib/utils";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { DECK } from "@/lib/deck-colors";

// Mirrors the weighted scoring in src/lib/understanding.ts
const FN_FR = new Set(
  ("le la les l un une des de du d au aux à a et ou mais que qui je tu il elle on nous vous ils elles me te se lui " +
    "ce cet cette ces mon ma mes ton ta tes son sa ses est sont ne n pas si oui non plus très bien pour par sur " +
    "sous dans avec sans comme moi s y en").split(" "),
);
const norm = (t: string) => t.toLowerCase().replace(/[.,!?;:''«»]/g, "").trim();
const weightOf = (t: string) => (FN_FR.has(norm(t)) ? 0.25 : 1);

interface DemoLine {
  text: string;
  tr: string;
  unknown: string[];
}

const LINES: DemoLine[] = [
  { text: "Je voudrais un café noir, s'il vous plaît", tr: "I would like a black coffee, please", unknown: ["voudrais", "noir"] },
  { text: "Elle regarde la pluie tomber sur la ville", tr: "She watches the rain fall on the city", unknown: ["pluie", "tomber"] },
  { text: "Nous allons au marché demain matin", tr: "We are going to the market tomorrow morning", unknown: ["marché"] },
  { text: "Le vieux monsieur lit son journal près de la fenêtre", tr: "The old man reads his newspaper by the window", unknown: ["journal", "fenêtre", "lit"] },
  { text: "Tu veux marcher avec moi ce soir ?", tr: "Do you want to walk with me tonight?", unknown: ["marcher", "soir"] },
  { text: "La musique douce remplit la petite salle", tr: "The soft music fills the little room", unknown: ["remplit", "douce"] },
];

type WordTier = "white" | "red" | "orange" | "green";

interface WordState {
  text: string;
  weight: number;
  tier: WordTier;
}

const TIER_NEXT: Record<WordTier, WordTier> = {
  white: "red",
  red: "orange",
  orange: "green",
  green: "green",
};

const TIER_COLOR: Record<WordTier, string | undefined> = {
  white: undefined,
  red: DECK.red,
  orange: DECK.orange,
  green: DECK.green,
};

const buildWords = (line: DemoLine): WordState[] => {
  const unknown = new Set(line.unknown.map(norm));
  return line.text.split(" ").map((text) => ({
    text,
    weight: weightOf(text),
    tier: unknown.has(norm(text)) ? "white" : "green",
  }));
};

/** Weighted green percentage — only fully-green words count. */
const scoreOf = (words: WordState[]) => {
  let known = 0;
  let total = 0;
  for (const w of words) {
    total += w.weight;
    if (w.tier === "green") known += w.weight;
  }
  return total ? Math.round((known / total) * 100) : 0;
};

/** Chameleon tier based on line's green percentage. */
function chamTierFor(pct: number): ChameleonTier {
  if (pct >= 80) return "green";
  if (pct >= 35) return "orange";
  return "red";
}

const Demo2 = () => {
  const [lineIdx, setLineIdx] = useState(0);
  const [words, setWords] = useState<WordState[]>(() => buildWords(LINES[0]));
  const [locked, setLocked] = useState(false);
  const [combo, setCombo] = useState(0);
  const [xpShown, setXpShown] = useState(0);
  const [praise, setPraise] = useState<{ big: string; sub: string; size: number; key: number } | null>(null);
  const [floatXp, setFloatXp] = useState<{ text: string; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);
  const [entering, setEntering] = useState(true);
  const [chamParty, setChamParty] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const confettiRef = useRef<ConfettiBurst | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const xpRafRef = useRef<number>(0);
  const xpRef = useRef(0);
  const xpShownRef = useRef(0);

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
  const chamTier = chamParty ? "green" : chamTierFor(pct);

  const loadLine = useCallback((idx: number) => {
    const next = ((idx % LINES.length) + LINES.length) % LINES.length;
    setLineIdx(next);
    setWords(buildWords(LINES[next]));
    setLocked(false);
    setEntering(true);
    setChamParty(false);
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

  const blast = useCallback(
    (comboNow: number) => {
      const reduced = prefersReducedMotion();
      const gained = xpForCombo(comboNow);
      if (!reduced) sharedGoldSweep(lineRef.current);

      later(() => {
        if (!reduced) sharedScatterClones(stageRef.current, lineRef.current, fxRef.current);
        const [big, sub] = PRAISE[comboNow];
        setPraise({ big, sub, size: comboNow, key: Date.now() });
        setFloatXp({ text: floatXpText(comboNow), key: Date.now() });
        xpRef.current += gained;
        countUpXp(xpRef.current);
        setChamParty(true);
        if (comboNow >= 2 && !reduced) {
          if (!confettiRef.current) {
            confettiRef.current = makeConfettiBurst(canvasRef.current);
          }
          confettiRef.current.fire(confettiCountForCombo(comboNow));
          setGlowKey(Date.now());
        }
      }, reduced ? 0 : 220);

      later(() => loadLine(lineIdx + 1), reduced ? 1500 : 2100);
    },
    [countUpXp, later, lineIdx, loadLine],
  );

  /** Advance the word one tier per tap, blast when all green. */
  const tapWord = (i: number) => {
    if (locked || words[i].tier === "green") return;
    const next = words.map((w, j) =>
      j === i ? { ...w, tier: TIER_NEXT[w.tier] } : w,
    );
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
    setWords((prev) => prev.map((w) => ({ ...w, tier: "green" as WordTier })));
    const comboNow = COMBO_CAP;
    setCombo(comboNow);
    blast(comboNow);
  };

  const line = LINES[lineIdx];

  return (
    <div className="min-h-screen bg-[#08080B] text-white antialiased flex flex-col items-center justify-center px-4 py-12">
      <style>{`
        @keyframes lb-praise-in {
          0%   { opacity: 0; transform: scale(0.4); }
          12%  { opacity: 1; transform: scale(1.12); }
          20%  { transform: scale(1); }
          78%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(1.04) translateY(-14px); }
        }
        @keyframes lb-xp-rise {
          0%   { opacity: 0; transform: translate(-50%, 10px); }
          18%  { opacity: 1; }
          75%  { opacity: 1; }
          100% { opacity: 0; transform: translate(-50%, -48px); }
        }
        @keyframes lb-glow {
          0%   { opacity: 0; }
          22%  { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes lb-line-in {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lb-entering { animation: none !important; }
        }
      `}</style>

      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/40 mb-4">
        LinguaScript · Line Blast Demo
      </p>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-2 text-center">
        Tap a word.{" "}
        <span style={{ color: DECK.red }}>Red</span>{" → "}
        <span style={{ color: DECK.orange }}>orange</span>{" → "}
        <span style={{ color: DECK.green }}>green</span>.
      </h1>
      <p className="text-white/40 text-sm mb-10 text-center max-w-md">
        Each tap advances the word through the three decks. When the line is
        fully green, it blasts.
      </p>

      <div className="flex flex-col md:flex-row items-center gap-8 w-full max-w-4xl">
        {/* ── Chameleon ── */}
        <div className="flex flex-col items-center gap-3 md:w-40 shrink-0">
          <div className="w-32 md:w-40">
            <ChameleonMascot tier={chamTier} party={chamParty} />
          </div>
          <div
            className="text-[11px] font-extrabold uppercase tracking-[0.2em] transition-colors duration-700"
            style={{ color: TIER_COLOR[chamTier === "red" ? "red" : chamTier === "orange" ? "orange" : "green"] }}
          >
            {chamTier === "red" ? "Unknown" : chamTier === "orange" ? "Learning" : "Known"}
          </div>
        </div>

        {/* ── Demo frame ── */}
        <div className="select-none flex-1 w-full min-w-0">
          <div
            ref={stageRef}
            className="relative aspect-video max-h-[440px] w-full overflow-hidden rounded-2xl border border-border/60 bg-[#101917]"
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

            {/* Edge glow */}
            {glowKey > 0 && (
              <div
                key={`glow-${glowKey}`}
                className="pointer-events-none absolute inset-0 z-[35] rounded-2xl opacity-0 [box-shadow:inset_0_0_90px_rgba(52,211,153,0.55)]"
                style={{ animation: "lb-glow 0.9s ease-out forwards" }}
              />
            )}

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
                  tap to advance colour
                </span>
                <p
                  ref={lineRef}
                  className={cn("m-0 text-lg font-medium leading-relaxed sm:text-2xl", entering && "lb-entering")}
                  style={entering ? { animation: "lb-line-in 320ms cubic-bezier(0.16,1,0.3,1)" } : undefined}
                >
                  {words.map((w, i) => {
                    const color = TIER_COLOR[w.tier];
                    return (
                      <span
                        key={`${lineIdx}-${i}`}
                        role={w.tier === "green" ? undefined : "button"}
                        tabIndex={w.tier === "green" ? undefined : 0}
                        onClick={() => tapWord(i)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tapWord(i); }
                        }}
                        className={cn(
                          "inline-block whitespace-pre rounded transition-colors duration-300",
                          w.tier !== "green"
                            ? "cursor-pointer font-semibold hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400"
                            : "font-medium",
                        )}
                        style={color ? { color } : { color: "#ffffff" }}
                      >
                        {w.text}
                        {i < words.length - 1 ? " " : ""}
                      </span>
                    );
                  })}
                </p>
                <p className="mb-0 mt-1.5 text-xs font-light text-white/45 sm:text-sm">{line.tr}</p>
              </div>
            </div>

            {/* FX layers */}
            <div ref={fxRef} className="pointer-events-none absolute inset-0 z-40" />
            <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 z-[45] h-full w-full" />

            {/* Praise */}
            {praise && praise.big && (
              <div
                key={`praise-${praise.key}`}
                className="pointer-events-none absolute inset-x-0 top-[28%] z-50 flex flex-col items-center gap-1 opacity-0"
                style={{ animation: "lb-praise-in 1.5s cubic-bezier(0.16,1,0.3,1) forwards" }}
              >
                <div
                  className="text-center font-black italic leading-none tracking-tight text-amber-400 [transform:skewX(-6deg)] [text-shadow:0_2px_0_rgba(0,0,0,0.35),0_0_34px_rgba(251,191,36,0.5)]"
                  style={{ fontSize: `clamp(${22 + praise.size * 4}px, ${3 + praise.size * 1.2}vw, ${36 + praise.size * 12}px)` }}
                >
                  {praise.big}
                </div>
                {praise.sub && (
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-300 [text-shadow:0_0_16px_rgba(52,211,153,0.6)]">
                    {praise.sub}
                  </div>
                )}
              </div>
            )}

            {/* Floating +XP */}
            {floatXp && (
              <div
                key={`xp-${floatXp.key}`}
                className="pointer-events-none absolute bottom-[26%] left-1/2 z-50 text-base font-extrabold tabular-nums text-emerald-400 opacity-0 [text-shadow:0_0_14px_rgba(52,211,153,0.7)]"
                style={{ animation: "lb-xp-rise 1.3s ease-out forwards" }}
              >
                {floatXp.text}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => { if (!locked) loadLine(lineIdx + 1); }}
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
      </div>

      {/* Deck key */}
      <div className="mt-12 flex items-center gap-6 text-sm text-white/50">
        {(["red", "orange", "green"] as const).map((tier) => (
          <span key={tier} className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: TIER_COLOR[tier] }}
            />
            {tier === "red" ? "Unknown" : tier === "orange" ? "Learning" : "Known"}
          </span>
        ))}
      </div>
    </div>
  );
};

export default Demo2;
