// GapFillChallenge — the Block Blast-style vocabulary moment.
//
// When a LinguaScript line is all green except ONE word you're still learning,
// playback pauses and that word is blanked out. Its candidates sit at the bottom
// as chunky draggable blocks (Block Blast style: saturated tile, inner top-left
// highlight, darker bottom bevel, drop shadow). Drag the right block into the
// gap to complete the line — it snaps in, the line fires the gold sweep, and the
// chameleon transforms. Wrong block → shake and bounce back.
//
// Block visual language referenced from open-source Block Blast clones
// (aayanaqdas/block_blast, futzumi/block-blast, tokaa1/blockerino).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChameleonMascot, ChameleonTier } from "./ChameleonMascot";

export interface GapFillChallengeProps {
  /** The full line, already split into words. */
  words: string[];
  /** Index into `words` of the blanked-out word. */
  gapIndex: number;
  /** Wrong options shown alongside the answer. */
  distractors: string[];
  /** Deck state of the answer — drives the block colour. */
  tier: "red" | "orange";
  /** Native-language translation, shown under the line. */
  translation?: string;
  onComplete: () => void;
  onSkip: () => void;
}

// Block Blast palette: [face, light highlight, dark bevel]
const BLOCK_SKINS: Record<string, [string, string, string]> = {
  red: ["#FF3B30", "#FF7A72", "#C22A22"],
  orange: ["#FF8A00", "#FFB44D", "#C46500"],
  green: ["#34C759", "#6BE08A", "#1F8F3E"],
  slate: ["#41414d", "#5a5a69", "#2a2a33"],
};

function WordBlock({
  label,
  skin = "slate",
  size = "md",
  dragging = false,
  style,
  ...rest
}: {
  label: string;
  skin?: keyof typeof BLOCK_SKINS;
  size?: "md" | "sm";
  dragging?: boolean;
  style?: React.CSSProperties;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [face, light, dark] = BLOCK_SKINS[skin] ?? BLOCK_SKINS.slate;
  return (
    <div
      {...rest}
      className={`select-none rounded-2xl text-center font-extrabold text-white ${
        size === "md" ? "px-5 py-3 text-lg" : "px-3.5 py-2 text-sm"
      } ${dragging ? "" : "transition-transform duration-150"}`}
      style={{
        background: `linear-gradient(160deg, ${light} 0%, ${face} 42%, ${face} 72%, ${dark} 100%)`,
        boxShadow: dragging
          ? `0 18px 34px rgba(0,0,0,0.55), inset 0 2px 0 ${light}, inset 0 -4px 0 ${dark}`
          : `0 6px 0 ${dark}, 0 10px 20px rgba(0,0,0,0.45), inset 0 2px 0 ${light}`,
        textShadow: "0 2px 3px rgba(0,0,0,0.35)",
        cursor: "grab",
        touchAction: "none",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

const shuffle = <T,>(a: T[]): T[] => {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
};

export function GapFillChallenge({
  words,
  gapIndex,
  distractors,
  tier,
  translation,
  onComplete,
  onSkip,
}: GapFillChallengeProps) {
  const answer = words[gapIndex] ?? "";
  const options = useMemo(
    () => shuffle([answer, ...distractors.slice(0, 3)]),
    [answer, distractors],
  );

  const [filled, setFilled] = useState(false);
  const [wrongKey, setWrongKey] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ label: string; x: number; y: number } | null>(null);
  const [chamTier, setChamTier] = useState<ChameleonTier>(tier);
  const [party, setParty] = useState(false);

  const slotRef = useRef<HTMLSpanElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);

  // Gold sweep — same effect as /demo and the live subtitle line.
  const goldSweep = useCallback(() => {
    const line = lineRef.current;
    if (!line || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    line.querySelectorAll<HTMLElement>("[data-w]").forEach((span, i) => {
      span.animate(
        [{}, { color: "#fbbf24", textShadow: "0 0 16px rgba(251,191,36,0.85)", offset: 0.45 }, {}],
        { duration: 520, delay: i * 30, easing: "ease-out" },
      );
    });
  }, []);

  const attempt = useCallback(
    (label: string) => {
      if (filled) return;
      if (label === answer) {
        setFilled(true);
        setDrag(null);
        goldSweep();
        setChamTier("green");
        setParty(true);
        window.setTimeout(onComplete, 1500);
      } else {
        setWrongKey(label);
        setDrag(null);
        window.setTimeout(() => setWrongKey(null), 460);
      }
    },
    [answer, filled, goldSweep, onComplete],
  );

  // Pointer-based drag so it works with both mouse and touch.
  const startDrag = (label: string) => (e: React.PointerEvent) => {
    if (filled) return;
    e.preventDefault();
    setDrag({ label, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => setDrag((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d));
    const up = (e: PointerEvent) => {
      const box = slotRef.current?.getBoundingClientRect();
      const hit =
        box &&
        e.clientX >= box.left - 28 && e.clientX <= box.right + 28 &&
        e.clientY >= box.top - 28 && e.clientY <= box.bottom + 28;
      const label = drag.label;
      if (hit) attempt(label);
      else setDrag(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [drag, attempt]);

  return (
    <div className="pointer-events-auto relative mx-auto w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b1210]/95 p-6 backdrop-blur-xl sm:p-8">
      <style>{`
        @keyframes ls-gap-shake { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-7px)} 40%{transform:translateX(7px)} 60%{transform:translateX(-5px)} 80%{transform:translateX(5px)} }
        @keyframes ls-gap-pop { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes ls-slot-pulse { 0%,100%{border-color:rgba(255,255,255,0.28)} 50%{border-color:rgba(255,255,255,0.6)} }
      `}</style>

      <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.16em] text-white/40">
        Complete the LinguaScript
      </div>

      {/* mascot */}
      <div className="mb-3 flex justify-center">
        <ChameleonMascot tier={chamTier} party={party} style={{ width: 132 }} />
      </div>

      {/* the line with its gap */}
      <div
        ref={lineRef}
        className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-3 text-center text-2xl font-bold sm:text-3xl"
      >
        {words.map((w, i) =>
          i === gapIndex ? (
            <span
              key={i}
              ref={slotRef}
              data-w
              className="inline-flex min-w-[7ch] items-center justify-center rounded-xl px-2 py-1"
              style={
                filled
                  ? { color: "#34C759", animation: "ls-gap-pop 320ms cubic-bezier(0.16,1,0.3,1)" }
                  : {
                      border: "2px dashed rgba(255,255,255,0.28)",
                      background: "rgba(255,255,255,0.04)",
                      minHeight: "1.9em",
                      animation: "ls-slot-pulse 1.8s ease-in-out infinite",
                    }
              }
            >
              {filled ? answer : " "}
            </span>
          ) : (
            <span key={i} data-w style={{ color: "#34C759" }}>
              {w}
            </span>
          ),
        )}
      </div>

      {translation && (
        <p className="mt-3 text-center text-sm italic text-white/40">{translation}</p>
      )}

      {/* block tray */}
      <div className="mt-7 border-t border-white/10 pt-5">
        <div className="mb-3 text-center text-[11px] font-semibold uppercase tracking-widest text-white/35">
          {filled ? "Nice." : "Drag the missing word into the gap"}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {options.map((opt) => {
            const isAnswer = opt === answer;
            const used = filled && isAnswer;
            return (
              <WordBlock
                key={opt}
                label={opt}
                skin={used ? "green" : isAnswer ? tier : "slate"}
                dragging={drag?.label === opt}
                onPointerDown={startDrag(opt)}
                onDoubleClick={() => attempt(opt)}
                style={{
                  opacity: used ? 0.25 : drag?.label === opt ? 0.35 : 1,
                  animation: wrongKey === opt ? "ls-gap-shake 420ms ease-in-out" : undefined,
                  pointerEvents: filled ? "none" : undefined,
                }}
              />
            );
          })}
        </div>
      </div>

      {!filled && (
        <button
          onClick={onSkip}
          className="mx-auto mt-5 block rounded-full px-4 py-1.5 text-xs font-semibold text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
        >
          Skip for now
        </button>
      )}

      {/* floating dragged block */}
      {drag && (
        <div
          className="pointer-events-none fixed z-[100]"
          style={{ left: drag.x, top: drag.y, transform: "translate(-50%, -50%) scale(1.08) rotate(-2deg)" }}
        >
          <WordBlock label={drag.label} skin={drag.label === answer ? tier : "slate"} dragging />
        </div>
      )}
    </div>
  );
}
