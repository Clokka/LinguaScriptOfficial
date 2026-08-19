import type { CSSProperties, HTMLAttributes } from "react";

/**
 * The Block Blast tile — LinguaScript's one genuinely distinctive component.
 *
 * It lived as a private function inside GapFillChallenge, so nothing else could
 * use it, and every other LinguaScript screen fell back to the default dark
 * shadcn card: `from-slate-800 to-slate-900` with a slate border, five files
 * deep. One good component and five screens ignoring it.
 *
 * It belongs here so it can be the atom of the whole app — the gap-fill tile,
 * the sentence-builder tile, the flashcard face. One component, one feel.
 *
 * The look is deliberate and worth preserving exactly: a saturated face, a light
 * inner highlight along the top edge, a hard dark bevel underneath, and a solid
 * drop shadow. That combination is what reads as a physical block rather than a
 * button, and it is why dragging one feels like it has weight.
 */

/** [face, light highlight, dark bevel] */
const BLOCK_SKINS = {
  red: ["#FF3B30", "#FF7A72", "#C22A22"],
  orange: ["#FF8A00", "#FFB44D", "#C46500"],
  green: ["#34C759", "#6BE08A", "#1F8F3E"],
  slate: ["#41414d", "#5a5a69", "#2a2a33"],
} as const satisfies Record<string, readonly [string, string, string]>;

export type BlockSkin = keyof typeof BLOCK_SKINS;

export interface WordBlockProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  /**
   * Red, orange and green here mean deck state and nothing else — they are the
   * word-mastery colours and must not be used decoratively. Anything that isn't
   * about mastery uses `slate`.
   */
  skin?: BlockSkin;
  size?: "md" | "sm";
  /** Lifts the tile: bigger shadow, no transition fighting the drag. */
  dragging?: boolean;
  /**
   * Whether this tile can be picked up. Only drives the cursor — a flashcard
   * face is the same block but nobody should be invited to drag it.
   */
  draggable?: boolean;
  style?: CSSProperties;
}

export function WordBlock({
  label,
  skin = "slate",
  size = "md",
  dragging = false,
  draggable = true,
  style,
  ...rest
}: WordBlockProps) {
  const [face, light, dark] = BLOCK_SKINS[skin] ?? BLOCK_SKINS.slate;
  return (
    <div
      {...rest}
      className={`select-none rounded-2xl text-center font-extrabold text-white ${
        size === "md" ? "px-5 py-3 text-lg" : "px-3.5 py-2 text-sm"
      } ${dragging ? "" : "transition-transform duration-150"} ${rest.className ?? ""}`}
      style={{
        background: `linear-gradient(160deg, ${light} 0%, ${face} 42%, ${face} 72%, ${dark} 100%)`,
        boxShadow: dragging
          ? `0 18px 34px rgba(0,0,0,0.55), inset 0 2px 0 ${light}, inset 0 -4px 0 ${dark}`
          : `0 6px 0 ${dark}, 0 10px 20px rgba(0,0,0,0.45), inset 0 2px 0 ${light}`,
        textShadow: "0 2px 3px rgba(0,0,0,0.35)",
        cursor: draggable ? "grab" : "default",
        touchAction: "none",
        ...style,
      }}
    >
      {label}
    </div>
  );
}

export default WordBlock;
