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
import { createPortal } from "react-dom";
import { ChameleonMascot, ChameleonTier } from "./ChameleonMascot";
import { WordBlock } from "@/components/blocks/WordBlock";

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
  //
  // The tile used to be positioned from React state updated on every
  // pointermove: each move queued a render, so the block always painted a frame
  // or two behind the finger and felt like it was on elastic. The pointer
  // position now goes straight onto the element's transform inside the event,
  // batched into a rAF — no React render sits between the finger and the pixel.
  const dragElRef = useRef<HTMLDivElement>(null);
  const dragPosRef = useRef({ x: 0, y: 0 });
  // Exact point inside the source tile where the pointer landed, measured from
  // its top-left corner. The body-level clone uses the same viewport coordinate
  // system as clientX/clientY, so this offset stays valid while scrolled and
  // inside fullscreen/backdrop-filtered ancestors.
  const grabOffsetRef = useRef({ x: 0, y: 0 });
  const dragSizeRef = useRef({ width: 0, height: 0 });
  const activePointerRef = useRef<number | null>(null);

  const paintDrag = useCallback(() => {
    rafRef.current = null;
    const el = dragElRef.current;
    if (!el) return;
    const { x, y } = dragPosRef.current;
    const o = grabOffsetRef.current;
    el.style.transform = `translate3d(${x - o.x}px, ${y - o.y}px, 0)`;
  }, []);

  const startDrag = (label: string) => (e: React.PointerEvent) => {
    if (filled) return;
    e.preventDefault();
    // Touch pointers get implicit capture on the block, which pins pointermove
    // to it and made the drag look frozen on phones — release it so the window
    // listeners drive.
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    grabOffsetRef.current = {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    };
    dragSizeRef.current = { width: r.width, height: r.height };
    activePointerRef.current = e.pointerId;
    dragPosRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ label, x: e.clientX, y: e.clientY });
  };


  // Position the floating tile the instant it mounts, before the first move.
  useEffect(() => {
    if (drag) paintDrag();
  }, [drag, paintDrag]);

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      dragPosRef.current = { x: e.clientX, y: e.clientY };
      paintDrag();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== activePointerRef.current) return;
      const box = slotRef.current?.getBoundingClientRect();
      // Test the tile's centre, not the raw finger point, so an edge grab
      // drops where the block visually sits.
      const cx = e.clientX - grabOffsetRef.current.x + dragSizeRef.current.width / 2;
      const cy = e.clientY - grabOffsetRef.current.y + dragSizeRef.current.height / 2;
      const hit =
        box &&
        cx >= box.left - 40 && cx <= box.right + 40 &&
        cy >= box.top - 40 && cy <= box.bottom + 40;

      const label = drag.label;
      activePointerRef.current = null;
      if (hit) attempt(label);
      else setDrag(null);
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up, { once: true });
    window.addEventListener("pointercancel", up, { once: true });
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag, attempt, paintDrag]);


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
      {drag && createPortal(
        <div
          ref={dragElRef}
          className="pointer-events-none fixed left-0 top-0 z-[100] will-change-transform"
          style={{ width: dragSizeRef.current.width }}
        >
          <WordBlock label={drag.label} skin={drag.label === answer ? tier : "slate"} dragging />
        </div>,
        document.body,
      )}

    </div>
  );
}
