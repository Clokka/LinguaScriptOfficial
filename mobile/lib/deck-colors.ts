import { isDueGold } from "@linguascript/core";
/**
 * Canonical LinguaScript colours for the mobile app.
 *
 * Mirrors src/lib/deck-colors.ts. React Native can't import from the web
 * `src/` tree, so this is a deliberate copy — if you change a value here,
 * change it there and in brand/README.md, which is the source of truth.
 *
 * The three deck colours carry meaning: a word's colour IS its deck, and the
 * mapping is identical on every surface (flashcards, web player, Netflix and
 * YouTube overlays, and this app).
 */
export const DECK = {
  /** Unknown / newly saved. */
  red: "#FF3B30",
  /** Learning. */
  orange: "#FF8A00",
  /** Known / acquired. */
  green: "#34C759",
} as const;

export type DeckState = keyof typeof DECK;

/** A known word that's due for review (GOLD.core in src/lib/goldenReveal.ts). */
export const GOLD = "#FFD54A";

export type WordColour = DeckState | "gold";

/**
 * A saved word's colour: its deck, or gold when it's green and its review is
 * due — 5 minutes after turning green, then on next_review. Same rule as
 * isDueGold() in packages/core/src/vocab.ts and deckState() in the extension.
 */
export function wordColour(w: { state?: string | null; next_review?: string | null; interval_days?: number | null; state_changed_at?: string | null; green_revealed_at?: string | null }): WordColour {
  const deck: DeckState = w.state === "green" ? "green" : w.state === "orange" ? "orange" : "red";
  return isDueGold(w) ? "gold" : deck;
}

export const WORD_COLOURS: Record<WordColour, string> = { ...DECK, gold: GOLD };

/** Surface colours, matched to the web landing page. */
export const UI = {
  /** Page background — same near-black as /landingpage4. */
  bg: "#08080B",
  /** Raised surface (cards, tab bar). */
  surface: "#121218",
  /** Hairline borders. */
  border: "rgba(255,255,255,0.10)",
  text: "#FFFFFF",
  textMuted: "rgba(255,255,255,0.55)",
  textFaint: "rgba(255,255,255,0.35)",
} as const;
