import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MousePointer2, Check, RotateCcw } from "lucide-react";
import {
  PRAISE,
  prefersReducedMotion,
  floatXpText,
  confettiCountForCombo,
  scatterClones,
  goldSweep,
  makeConfettiBurst,
  type ConfettiBurst,
} from "@/lib/lineBlast";
import { LineBlastOverlay } from "@/components/LineBlastOverlay";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { DECK, CELEBRATION_GOLD } from "@/lib/deck-colors";
import type { DemoLine } from "@/lib/landingDemoLines";

/**
 * LinguaScript's core loop, playable in the landing page:
 *
 *   white word in a subtitle → tap → RED deck → review → ORANGE → review →
 *   GREEN (flashes GOLD the first time) → every word green → Line Blast.
 *
 * If nobody touches it, it plays itself once with a ghost cursor so a visitor
 * who only looks for five seconds still sees the whole idea.
 */

type Tier = -1 | 0 | 1 | 2; // white (unsaved), red, orange, green
const TIER_COLOR: Record<Tier, string> = { [-1]: "#F4F7F5", 0: DECK.red, 1: DECK.orange, 2: DECK.green };
const DECKS = [
  { name: "New", c: DECK.red },
  { name: "Learning", c: DECK.orange },
  { name: "Known", c: DECK.green },
] as const;

export const CoreLoopDemo = ({ line }: { line: DemoLine }) => {
  const n = line.words.length;
  const [tiers, setTiers] = useState<Tier[]>(() => line.words.map(() => -1 as Tier));
  const [flipped, setFlipped] = useState(false);
  const [gold, setGold] = useState<number | null>(null);
  const [blasted, setBlasted] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; press: boolean } | null>(null);
  const [userTouched, setUserTouched] = useState(false);
  const [praise, setPraise] = useState<{ big: string; sub: string; combo: number; key: number } | null>(null);
  const [floatXp, setFloatXp] = useState<{ text: string; key: number } | null>(null);
  const [glowKey, setGlowKey] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLParagraphElement>(null);
  const fxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLButtonElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const burstRef = useRef<ConfettiBurst | null>(null);
  const timers = useRef<number[]>([]);
  const autoplayed = useRef(false);

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms));
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = []; };

  // New language → fresh line.
  useEffect(() => {
    clearTimers();
    setTiers(line.words.map(() => -1 as Tier));
    setFlipped(false); setGold(null); setBlasted(false); setCursor(null);
  }, [line]);

  useEffect(() => {
    burstRef.current = makeConfettiBurst(canvasRef.current);
    return () => { clearTimers(); burstRef.current?.reset(); };
  }, []);

  // The card being reviewed: newest-colour word first (red before orange).
  const current = useMemo(() => {
    for (const t of [0, 1] as Tier[]) {
      const i = tiers.findIndex((x) => x === t);
      if (i >= 0) return i;
    }
    return -1;
  }, [tiers]);

  const counts = [0, 1, 2].map((t) => tiers.filter((x) => x === t).length);
  const mascot: ChameleonTier = tiers.some((t) => t === 0) ? "red" : tiers.some((t) => t === 1) ? "orange" : "green";

  const blast = useCallback(() => {
    setBlasted(true);
    if (prefersReducedMotion()) {
      setPraise({ big: PRAISE[3][0], sub: PRAISE[3][1], combo: 3, key: Date.now() });
      return;
    }
    goldSweep(lineRef.current);
    later(() => {
      scatterClones(stageRef.current, lineRef.current, fxRef.current);
      burstRef.current?.fire(confettiCountForCombo(4));
      setGlowKey((k) => k + 1);
      setPraise({ big: PRAISE[4][0], sub: PRAISE[4][1], combo: 4, key: Date.now() });
      setFloatXp({ text: floatXpText(4), key: Date.now() });
    }, 420);
  }, []);

  /** Tap a white word: it turns red and goes into the New deck. */
  const save = (i: number) => {
    setTiers((t) => (t[i] === -1 ? t.map((x, j) => (j === i ? 0 : x)) as Tier[] : t));
    setFlipped(false);
  };

  /** "I knew it" on the flashcard: the word moves up one deck. */
  const knewIt = () => {
    if (current < 0) return;
    const i = current;
    const next = tiers.map((x, j) => (j === i ? ((x + 1) as Tier) : x)) as Tier[];
    setTiers(next);
    setFlipped(false);
    if (next[i] === 2) {
      setGold(i); // first time green → gold
      later(() => setGold((g) => (g === i ? null : g)), 950);
      if (next.every((x) => x === 2)) later(blast, 900);
    }
  };

  const reset = () => {
    lineRef.current?.querySelectorAll("span").forEach((s) => s.getAnimations().forEach((a) => a.cancel()));
    setBlasted(false);
    setTiers(line.words.map(() => -1 as Tier));
    setFlipped(false);
  };

  const touch = () => {
    if (!userTouched) {
      setUserTouched(true);
      clearTimers();
      setCursor(null);
    }
  };

  // ── Ghost demo: plays the loop once on one word if the visitor doesn't touch it ──
  const pointAt = (el: Element | null, press = false) => {
    const root = rootRef.current;
    if (!el || !root) return;
    const r = el.getBoundingClientRect();
    const b = root.getBoundingClientRect();
    setCursor({ x: r.left - b.left + r.width / 2, y: r.top - b.top + r.height / 2, press });
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion()) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || autoplayed.current || userTouched) return;
      autoplayed.current = true;
      io.disconnect();
      const i = Math.min(n - 1, Math.max(1, Math.floor(n / 2))); // a word in the middle
      const step = (ms: number, fn: () => void) => later(fn, ms);
      step(900, () => pointAt(wordRefs.current[i]));
      step(1500, () => { pointAt(wordRefs.current[i], true); save(i); });
      step(2200, () => pointAt(cardRef.current));
      step(2700, () => { pointAt(cardRef.current, true); setFlipped(true); });
      step(3300, () => pointAt(btnRef.current));
      step(3800, () => { pointAt(btnRef.current, true); setTiers((t) => t.map((x, j) => (j === i ? 1 : x)) as Tier[]); setFlipped(false); });
      step(4500, () => { pointAt(cardRef.current, true); setFlipped(true); });
      step(5100, () => pointAt(btnRef.current));
      step(5600, () => {
        pointAt(btnRef.current, true);
        setTiers((t) => t.map((x, j) => (j === i ? 2 : x)) as Tier[]);
        setFlipped(false);
        setGold(i);
      });
      step(6600, () => { setGold(null); setCursor(null); });
    }, { threshold: 0.6 });
    io.observe(root);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [line, userTouched]);

  const cw = current >= 0 ? line.words[current] : null;
  const cardTier = current >= 0 ? tiers[current] : 2;
  const cardColor = TIER_COLOR[cardTier as Tier];

  return (
    <div ref={rootRef} className="relative select-none" onPointerDown={touch}>
      <style>{`
        @keyframes ls-shine { 0%{text-shadow:0 0 0 transparent} 40%{text-shadow:0 0 22px ${CELEBRATION_GOLD}} 100%{text-shadow:0 0 0 transparent} }
        @keyframes ls-hint { 0%,100%{opacity:1} 50%{opacity:.55} }
        .ls-w{cursor:pointer;-webkit-tap-highlight-color:transparent;transition:color .35s ease;border-radius:6px}
        .ls-w:hover{background:rgba(255,255,255,.07)}
        .ls-gold{color:${CELEBRATION_GOLD}!important;animation:ls-shine .9s ease-out}
      `}</style>

      {/* ── The "video": chameleon + subtitle line ── */}
      <div
        ref={stageRef}
        className="relative rounded-2xl overflow-hidden border border-white/10 px-4 pt-3 pb-4"
        style={{ background: "radial-gradient(120% 90% at 30% 10%, #2a2a33 0%, #121218 55%, #0b0b10 100%)" }}
      >
        <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full z-40" />
        <div ref={fxRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-40" />

        <div className="flex items-center justify-between">
          <div className="w-14 sm:w-16 transition-all"><ChameleonMascot tier={mascot} party={blasted} /></div>
          <div className="flex gap-1.5" aria-hidden="true">
            {tiers.map((t, i) => (
              <span key={i} className="w-2 h-2 rounded-full transition-colors" style={{ backgroundColor: t === -1 ? "rgba(255,255,255,.18)" : TIER_COLOR[t] }} />
            ))}
          </div>
        </div>

        <div className="mt-2 sm:mt-8 mx-auto max-w-xl rounded-xl bg-black/45 px-3 py-3 text-center">
          <p
            ref={lineRef}
            className={`text-2xl sm:text-3xl font-bold leading-snug ${line.noSpaces ? "" : "[word-spacing:0.15em]"}`}
            translate="no"
          >
            {line.words.map((wd, i) => (
              <span
                key={`${wd.w}-${i}`}
                ref={(el) => (wordRefs.current[i] = el)}
                role="button"
                tabIndex={0}
                aria-label={tiers[i] === -1 ? `Save "${wd.w}" to flashcards` : `${wd.w}: ${DECKS[tiers[i]].name}`}
                onClick={() => save(i)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); save(i); } }}
                className={`ls-w px-0.5 ${gold === i ? "ls-gold" : ""}`}
                style={{ color: TIER_COLOR[tiers[i]], ...(userTouched || tiers[i] !== -1 ? {} : { animation: cursor ? "none" : "ls-hint 2.4s ease-in-out infinite" }) }}
              >
                {wd.w}{line.noSpaces ? "" : " "}
              </span>
            ))}
          </p>
          {line.translation && <p className="mt-1.5 text-sm text-white/55">{line.translation}</p>}
        </div>

        <div className="mt-3 h-1 rounded-full bg-white/10 overflow-hidden" aria-hidden="true">
          <div className="h-full w-[38%] rounded-full bg-white/50" />
        </div>
        <LineBlastOverlay praise={praise} floatXp={floatXp} glowKey={glowKey} placement="stage" />
      </div>

      {/* ── Flashcards: three decks + the card you're reviewing ── */}
      <div className="mt-3 grid grid-cols-[1fr_1.4fr] gap-3">
        <div className="grid grid-rows-3 gap-2">
          {DECKS.map((d, t) => (
            <div key={d.name} className="flex items-center justify-between rounded-xl px-3 py-2 bg-white/[0.04]" style={{ border: `1px solid ${d.c}55` }}>
              <span className="text-xs sm:text-sm font-bold" style={{ color: d.c }}>{d.name}</span>
              <span key={counts[t]} className="text-sm font-bold tabular-nums text-white animate-in zoom-in-50 duration-300">{counts[t]}</span>
            </div>
          ))}
        </div>

        {blasted ? (
          <button onClick={reset} className="rounded-xl bg-white/[0.05] border border-white/10 flex flex-col items-center justify-center gap-1 text-white/80">
            <RotateCcw className="w-5 h-5" />
            <span className="text-sm font-semibold">Play again</span>
          </button>
        ) : cw ? (
          <div className="flex flex-col gap-2">
            <button
              ref={cardRef}
              onClick={() => setFlipped((f) => !f)}
              className="flex-1 rounded-xl px-3 py-2 flex flex-col items-center justify-center text-center transition-colors"
              style={{ backgroundColor: `${cardColor}1a`, border: `1.5px solid ${cardColor}` }}
              aria-label={flipped ? `${cw.w} means ${cw.m}` : `Flashcard: ${cw.w}. Tap to flip.`}
            >
              {flipped ? (
                <>
                  <span className="text-xs text-white/50" translate="no">{cw.w}</span>
                  <span className="text-lg font-bold text-white">{cw.m}</span>
                </>
              ) : (
                <span className="text-xl font-bold" style={{ color: cardColor }} translate="no">{cw.w}</span>
              )}
            </button>
            <button
              ref={btnRef}
              onClick={knewIt}
              disabled={!flipped}
              className="h-9 rounded-lg text-sm font-bold text-[#08080B] disabled:opacity-30 transition-opacity inline-flex items-center justify-center gap-1"
              style={{ backgroundColor: DECK.green }}
            >
              <Check className="w-4 h-4" /> I knew it
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 flex items-center justify-center px-3 text-center text-sm text-white/40">
            {tiers.every((t) => t === 2) ? "All known!" : "Your flashcards"}
          </div>
        )}
      </div>

      {/* Ghost cursor for the self-playing demo */}
      {cursor && (
        <MousePointer2
          aria-hidden="true"
          className="pointer-events-none absolute z-50 w-6 h-6 text-white drop-shadow-[0_2px_6px_rgba(0,0,0,.8)] transition-all duration-500 ease-out"
          style={{ left: cursor.x, top: cursor.y, transform: `translate(-20%,-10%) scale(${cursor.press ? 0.8 : 1})`, fill: "white" }}
        />
      )}
    </div>
  );
};

export default CoreLoopDemo;
