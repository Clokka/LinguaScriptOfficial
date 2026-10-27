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

/** A known word that's due for review (GOLD.core in src/lib/dueGold.ts). */
export const GOLD = "#FFD54A";

export type WordColour = DeckState | "gold";

/**
 * A saved word's colour: its deck, or gold when it's green and its review is
 * due (next_review is a YYYY-MM-DD date). Same rule as isDueForReview in
 * src/lib/dueGold.ts; reviewing it turns it back to green.
 */
export function wordColour(state: string | null | undefined, nextReview?: string | null): WordColour {
  const deck: DeckState = state === "green" ? "green" : state === "orange" ? "orange" : "red";
  const today = new Date().toLocaleDateString("en-CA");
  return deck === "green" && nextReview && nextReview.slice(0, 10) <= today ? "gold" : deck;
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
