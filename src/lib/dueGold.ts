/**
 * Gold = a green word that spaced repetition says is due for review.
 *
 *   red     just saved / unknown
 *   orange  learning
 *   green   known
 *   GOLD    known, and it's time to check it again
 *
 * Reviewing it in Flashcards moves next_review forward, so it goes back to
 * green until it's due again. Gold is never stored: it's worked out here from
 * the deck state and the due date, so the player, the word map and the Chrome
 * extension (deckState() in extension/background.js) agree. Words parked at
 * 2999-01-01 (pre-marked known from a chosen level) are never due.
 */

/** The subset of a saved word this needs. */
export interface DueCandidate {
  state: string;
  /** `saved_words.next_review`, a `date` column (YYYY-MM-DD). */
  next_review?: string | null;
}

/** Today as YYYY-MM-DD in the learner's own timezone. */
export const localToday = (): string => new Date().toLocaleDateString("en-CA");

export function isDueForReview(word: DueCandidate | undefined | null, today = localToday()): boolean {
  if (!word || word.state !== "green" || !word.next_review) return false;
  return word.next_review.slice(0, 10) <= today;
}

/** Gold sits outside the red/orange/green deck palette. */
export const GOLD = {
  core: "#FFD54A",
  deep: "#FFAA1A",
  glow: "rgba(255, 200, 60, 0.55)",
} as const;
