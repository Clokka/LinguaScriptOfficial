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
