/**
 * Canonical deck colours — the heart of the LinguaScript brand.
 *
 * Source of truth: brand/README.md §1. Every saved word lives in one of three
 * decks and its colour is identical everywhere it appears: flashcards, the web
 * player, the Netflix overlay, and the YouTube overlay. Mapping is 1:1 and must
 * not shift on any surface.
 *
 * If you change one of these, update brand/README.md and the surfaces it lists.
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

/** Ordered weakest → strongest, the direction a word travels as you learn it. */
export const DECK_ORDER: DeckState[] = ["red", "orange", "green"];

/**
 * Celebration-only gold. Not a deck: it never marks a word's state, it only
 * fires during a Line Blast and on the landing hero. Kept here so the one
 * amber in the product cannot fork into five slightly different ambers.
 */
export const CELEBRATION_GOLD = "#FBBF24";
