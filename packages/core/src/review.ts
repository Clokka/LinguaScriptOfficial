/**
 * THE review rules — the one copy every LinguaScript app uses.
 *
 * Pure TypeScript: no Supabase, no React, no browser or phone APIs. So the
 * website (via the "@linguascript/core" alias in vite.config.ts), the Expo app
 * (packages/core dependency) and any future app can all import it as-is.
 * The Chrome extension is plain JS without a build step; its deckState() in
 * extension/background.js must follow the same rules, and
 * `npm run test:review` checks that it does.
 *
 *   red → orange → GREEN → (5 minutes) → GOLD = first review due
 *   reviewed → green → 1, 3, 7, 14, 30 days → then ×1.5 forever (45, 68, 102 …)
 *
 * interval_days = 0 on a green word means "just turned green, first review is
 * 5 minutes after state_changed_at". next_review is a date column, so it can't
 * hold minutes; that's why the first step uses state_changed_at.
 *
 * Tapping a gold word in a video turns it green on screen (green_revealed_at)
 * but does NOT count as a review: it stays due in flashcards until reviewed.
 */

export type DeckState = "red" | "orange" | "green";
/** What a word looks like right now: its deck, or gold when a review is due. */
export type DisplayState = DeckState | "gold";

/** Deck colours. `deep` = darker shade for words on light/white backgrounds. */
export const DECK_COLOURS: Record<DisplayState, { hex: string; deep: string }> = {
  red: { hex: "#FF3B30", deep: "#D92B21" },
  orange: { hex: "#FF8A00", deep: "#C05F00" },
  green: { hex: "#34C759", deep: "#34C759" },
  gold: { hex: "#FFD54A", deep: "#B07A00" },
};
export const BRAND_GREEN = "#7bbf27";

/** Coerce a stored state string into a valid DeckState (defaults to red). */
export const coerceDeckState = (raw: string | null | undefined): DeckState =>
  raw === "green" ? "green" : raw === "orange" ? "orange" : "red";

/** Normalise a token to its match key (lowercase, strip punctuation). */
export function normalizeToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:"'`«»()\[\]…，。、！？；：「」『』（）《》〈〉“”‘’]/g, "")
    .trim();
}

const STATE_RANK: Record<DeckState, number> = { red: 0, orange: 1, green: 2 };

/** The higher of two states, forward-only style — never demotes. */
export function maxState(a: DeckState, b: DeckState): DeckState {
  return STATE_RANK[a] >= STATE_RANK[b] ? a : b;
}

/** Is `a` behind `b`? (red < orange < green) */
export function isBehind(a: DeckState, b: DeckState): boolean {
  return STATE_RANK[a] < STATE_RANK[b];
}

/**
 * Forward-only progression: a right answer moves red→orange→green; a wrong
 * answer leaves the word where it is. A word never goes backwards.
 */
export function promote(current: DeckState, correct: boolean): DeckState {
  if (!correct) return current;
  if (current === "red") return "orange";
  return "green";
}

export const REVIEW_LADDER_DAYS = [1, 3, 7, 14, 30] as const;
export const REVIEW_GROWTH = 1.5;
/** First review after a word turns green. */
export const FIRST_REVIEW_MINUTES = 5;

/**
 * Days until the next review (0 = the 5-minute first step).
 *  - Missed it, or still red/orange: tomorrow.
 *  - Just turned green: 0 → gold 5 minutes later.
 *  - Green and remembered again: the next rung, then ×1.5 forever.
 */
export function nextReviewInterval(prevIntervalDays: number | null | undefined, correct: boolean, wasGreen: boolean, isGreen: boolean): number {
  if (!correct || !isGreen) return 1;
  if (!wasGreen) return 0;
  const prev = Math.max(0, prevIntervalDays ?? 0);
  const rung = REVIEW_LADDER_DAYS.find((d) => d > prev);
  if (rung !== undefined) return rung;
  return Math.max(prev + 1, Math.round(prev * REVIEW_GROWTH));
}

// Built by hand (not toLocaleDateString) so it gives the same answer on
// phones, whose JS engine may not support every locale.
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Today's date as YYYY-MM-DD in the learner's own timezone. */
export function todayLocal(d = new Date()): string {
  return ymd(d);
}

/** YYYY-MM-DD, `days` from today in the learner's own timezone. */
export function dateInDays(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export interface ReviewFields {
  state?: string | null;
  next_review?: string | null;
  interval_days?: number | null;
  state_changed_at?: string | null;
  green_revealed_at?: string | null;
}

/** When this green word's review falls due (ms), or null if it isn't green. */
export function reviewDueAt(w: ReviewFields | null | undefined): number | null {
  if (!w || w.state !== "green") return null;
  if ((w.interval_days ?? 1) === 0 && w.state_changed_at) {
    return Date.parse(w.state_changed_at) + FIRST_REVIEW_MINUTES * 60_000;
  }
  if (!w.next_review) return null;
  const [y, m, d] = String(w.next_review).slice(0, 10).split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).getTime(); // local midnight
}

/** The review is due (counts in flashcards) — whether or not it was tapped in a video. */
export function isReviewDue(w: ReviewFields | null | undefined, now = Date.now()): boolean {
  const at = reviewDueAt(w);
  return at !== null && at <= now;
}

/** GOLD = the review is due and the learner hasn't tapped it in a video since it fell due. */
export function isDueGold(w: ReviewFields | null | undefined, now = Date.now()): boolean {
  const at = reviewDueAt(w);
  if (at === null || at > now) return false;
  const tapped = w?.green_revealed_at ? Date.parse(w.green_revealed_at) : 0;
  return !(tapped >= at);
}

/** red / orange / green / gold — what colour a word shows right now. */
export function displayState(w: ReviewFields, now = Date.now()): DisplayState {
  return isDueGold(w, now) ? "gold" : coerceDeckState(w.state);
}

/** The saved_words columns a review cycle reads and rewrites. */
export interface SrsInput {
  ease_factor?: number | null;
  interval_days?: number | null;
  review_count?: number | null;
}

export interface SrsResult {
  ease_factor: number;
  interval_days: number;
  review_count: number;
  /** `saved_words.next_review` is a `date` column (YYYY-MM-DD). */
  next_review: string;
  last_reviewed_at: string;
  last_correct_at?: string;
}

/**
 * Schedule the next review on the ladder. `wasGreen` / `isGreen` are the deck
 * state before and after this answer — the ladder only climbs while a word
 * stays green. Does not touch `state`; use `promote` for that.
 * ease_factor is passed through for older rows; the ladder ignores it.
 */
export function applySrsReview(
  current: SrsInput,
  correct: boolean,
  states: { wasGreen: boolean; isGreen: boolean } = { wasGreen: false, isGreen: false },
): SrsResult {
  const nowIso = new Date().toISOString();
  const intervalDays = nextReviewInterval(current.interval_days, correct, states.wasGreen, states.isGreen);
  return {
    ease_factor: current.ease_factor ?? 2.5,
    interval_days: intervalDays,
    review_count: correct ? (current.review_count ?? 0) + 1 : 0,
    next_review: dateInDays(intervalDays),
    last_reviewed_at: nowIso,
    ...(correct ? { last_correct_at: nowIso } : {}),
  };
}
