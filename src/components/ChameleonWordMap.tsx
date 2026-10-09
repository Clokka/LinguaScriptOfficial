// Every word of a video as a coloured tile. When shown, tiles start at the
// colours the learner saw last time and flip to their real colours one by
// one — the visible proof that they are adapting to this video.
import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { GOLD } from "@/lib/goldenReveal";
import { prefersReducedMotion } from "@/lib/lineBlast";
import { loadSnapshot, saveSnapshot, type TileState, type WordTile } from "@/lib/videoWordMap";

const TILE_CLASS: Record<TileState, string> = {
  red: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  orange: "bg-orange-400/15 text-orange-300 border-orange-400/40",
  green: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  gold: "text-amber-950 border-amber-300",
};

/** Whole flip sequence stays under this, however many words changed. */
const FLIP_TOTAL_MS = 2400;
const FLIP_START_MS = 500;

interface Props {
  tiles: WordTile[];
  /** Film the tiles belong to — used to remember the colours seen last time. */
  filmId: string;
  className?: string;
  /** Called once the flip finishes, with how many words changed colour. */
  onFlipped?: (changed: number) => void;
}

export function ChameleonWordMap({ tiles, filmId, className, onFlipped }: Props) {
  // Re-read when tiles reload: the snapshot was just updated by the last flip.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const before = useMemo(() => loadSnapshot(filmId), [filmId, tiles]);
  const changed = useMemo(
    () => tiles.filter((t) => before[t.word] && before[t.word] !== (t.state === "gold" ? "green" : t.state)),
    [tiles, before],
  );
  const [flipped, setFlipped] = useState(changed.length === 0 || prefersReducedMotion());

  useEffect(() => {
    if (tiles.length === 0) return;
    const instant = changed.length === 0 || prefersReducedMotion();
    setFlipped(instant);
    const t1 = window.setTimeout(() => setFlipped(true), instant ? 0 : FLIP_START_MS);
    const t2 = window.setTimeout(() => {
      saveSnapshot(filmId, tiles);
      onFlipped?.(changed.length);
    }, instant ? 0 : FLIP_START_MS + FLIP_TOTAL_MS);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
    // onFlipped is intentionally not a dependency — a new callback identity
    // must not restart the animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiles, filmId, changed.length]);

  const step = changed.length > 0 ? Math.min(60, FLIP_TOTAL_MS / changed.length) : 0;
  const order = new Map(changed.map((t, i) => [t.word, i]));

  return (
    <div className={cn("flex flex-wrap gap-1", className)} translate="no">
      {tiles.map((t) => {
        const idx = order.get(t.word);
        const shown: TileState = !flipped && idx !== undefined ? before[t.word] : t.state;
        const isGold = shown === "gold";
        return (
          <span
            key={t.word}
            title={t.word}
            className={cn(
              "px-1.5 py-0.5 rounded-md border text-[11px] leading-tight font-medium transition-all duration-500",
              TILE_CLASS[shown],
              flipped && idx !== undefined && "animate-[chameleon-pop_0.5s_ease-out]",
            )}
            style={{
              transitionDelay: flipped && idx !== undefined ? `${idx * step}ms` : undefined,
              animationDelay: flipped && idx !== undefined ? `${idx * step}ms` : undefined,
              ...(isGold
                ? { background: `linear-gradient(135deg, ${GOLD.core}, ${GOLD.deep})`, boxShadow: `0 0 10px ${GOLD.glow}` }
                : null),
            }}
          >
            {t.word}
          </span>
        );
      })}
    </div>
  );
}
