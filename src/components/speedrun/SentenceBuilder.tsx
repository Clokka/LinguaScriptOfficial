// Tap the tiles in order to build the sentence. Tiles fly between the pool and
// the sentence with shared-layout animation; a wrong tile shakes back.
//   solid tile  = a word from the learner's Speed Run words so far
//   dashed tile = a bonus word (not in the list yet), labelled "new"
//   violet tile = looks like the English word (English speakers only)
import { useMemo, useState } from "react";
import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { Volume2 } from "lucide-react";
import { DECK_COLOURS } from "@linguascript/core/review";
import { playSfx } from "@/lib/sfx";
import { tokensOf, type BuildItem } from "@/lib/speedRun";
import { Eyebrow, StageButton, speak } from "./Stage";

const COGNATE = "#A78BFA";

interface Tile { id: string; text: string }

function shuffle<T>(xs: T[], seed: number): T[] {
  const a = [...xs];
  let s = seed * 9301 + 49297;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Never start already solved.
  if (a.length > 1 && a.every((t, i) => t === xs[i])) a.push(a.shift()!);
  return a;
}

export function SentenceBuilder({ items, known, lang, showCognates, tint, onDone }: {
  items: BuildItem[];
  known: Set<string>;
  lang: string;
  showCognates: boolean;
  tint: string;
  onDone: () => void;
}) {
  const reduce = useReducedMotion();
  const [idx, setIdx] = useState(0);
  const [placed, setPlaced] = useState<string[]>([]);
  const [wrong, setWrong] = useState<string | null>(null);
  const item = items[idx];

  const tiles: Tile[] = useMemo(() => item.tiles.map((text, i) => ({ id: `${idx}-${i}`, text })), [item, idx]);
  const pool = useMemo(() => shuffle(tiles, idx + item.tiles.length), [tiles, idx, item.tiles.length]);
  const done = placed.length === item.tiles.length;
  const byId = new Map(tiles.map((t) => [t.id, t]));

  const kind = (text: string): "known" | "cognate" | "bonus" => {
    if (showCognates && item.cognates?.includes(text)) return "cognate";
    const toks = tokensOf(text);
    if (toks.length === 0 || toks.every((t) => known.has(t))) return "known";
    return "bonus";
  };

  const tap = (t: Tile) => {
    if (done) return;
    const expected = item.tiles[placed.length];
    if (t.text === expected) {
      const next = [...placed, t.id];
      setPlaced(next);
      if (next.length === item.tiles.length) {
        playSfx("correct");
        setTimeout(() => speak(item.tiles.join(" "), lang), 250);
      } else {
        playSfx("tap");
      }
    } else {
      playSfx("miss");
      setWrong(t.id);
      setTimeout(() => setWrong(null), 450);
    }
  };

  const undo = (id: string) => {
    if (done) return;
    // Taking a tile back removes it and everything after it.
    const at = placed.indexOf(id);
    if (at >= 0) { playSfx("tap"); setPlaced(placed.slice(0, at)); }
  };

  const next = () => {
    if (idx + 1 < items.length) { setIdx(idx + 1); setPlaced([]); }
    else onDone();
  };

  const tileClass = (k: ReturnType<typeof kind>) =>
    k === "bonus"
      ? "border-2 border-dashed border-white/35 bg-transparent"
      : k === "cognate"
        ? "border-2 border-transparent"
        : "border-2 border-transparent bg-white/10";

  const tileStyle = (k: ReturnType<typeof kind>) => (k === "cognate" ? { background: `${COGNATE}2e`, color: "#DDD6FE" } : undefined);

  const renderTile = (t: Tile, inSentence: boolean) => {
    const k = kind(t.text);
    return (
      <motion.button
        key={t.id}
        layoutId={reduce ? undefined : t.id}
        onClick={() => (inSentence ? undo(t.id) : tap(t))}
        animate={wrong === t.id && !reduce ? { x: [0, -10, 10, -6, 6, 0] } : { x: 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        whileTap={{ scale: 0.94 }}
        className={`relative rounded-xl px-4 py-2.5 text-lg font-bold ${tileClass(k)}`}
        style={tileStyle(k)}
        translate="no"
        lang={lang}
      >
        {t.text}
        {k === "bonus" && !inSentence && (
          <span className="absolute -right-1.5 -top-2 rounded-full bg-white px-1.5 text-[9px] font-black uppercase text-black">new</span>
        )}
      </motion.button>
    );
  };

  return (
    <section>
      <Eyebrow>Build the sentence · {idx + 1} / {items.length}</Eyebrow>
      <h2 className="mt-3 text-3xl font-black leading-tight">“{item.gloss}”</h2>

      <LayoutGroup id={`build-${idx}`}>
        <motion.div
          className="mt-8 flex min-h-[72px] flex-wrap items-center gap-2 rounded-2xl border p-3"
          animate={{ borderColor: done ? DECK_COLOURS.green.hex : "rgba(255,255,255,.14)", boxShadow: done ? `0 0 40px -12px ${DECK_COLOURS.green.hex}` : "0 0 0 0 transparent" }}
        >
          {placed.map((id) => renderTile(byId.get(id)!, true))}
          {!done && <span className="h-8 w-0.5 animate-pulse rounded bg-white/40" aria-hidden />}
        </motion.div>

        <div className="mt-6 flex min-h-[60px] flex-wrap justify-center gap-2">
          {pool.filter((t) => !placed.includes(t.id)).map((t) => renderTile(t, false))}
        </div>
      </LayoutGroup>

      {done ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <button onClick={() => speak(item.tiles.join(" "), lang)} className="mt-6 flex items-center gap-2 text-white/70 hover:text-white">
            <Volume2 className="h-4 w-4" /> Hear it again
          </button>
          {item.fact && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-white/85">💡 {item.fact}</div>
          )}
          <StageButton tint={tint} onClick={next}>{idx + 1 < items.length ? "Next sentence" : "Practise the words"}</StageButton>
        </motion.div>
      ) : (
        <div className="mt-8 flex flex-wrap justify-center gap-4 text-xs text-white/50">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-white/20" /> your words</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-white/50" /> bonus word</span>
          {showCognates && item.cognates?.length ? (
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded" style={{ background: COGNATE }} /> looks like English</span>
          ) : null}
        </div>
      )}
    </section>
  );
}
