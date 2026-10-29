import { supabase } from "@/integrations/supabase/client";
import { isDueGold } from "@/lib/vocab";

/**
 * GOLD — a green word whose review is due.
 *
 *   red     never met it
 *   orange  learning
 *   green   known
 *   GOLD    known, and due for its next review (5 min after turning green,
 *           then 1, 3, 7, 14, 30 days, then ×1.5)
 *
 * Tapping it in a video turns it green on screen, but only a flashcard review
 * moves it up the ladder. This module is the
 * single source of truth for "is this word gold" on the website, matching
 * `deckState()` in extension/background.js.
 */

/** XP for spotting a gold word in a video. */
export const GOLD_CLAIM_XP = 5;

/** Kept for older imports. Gold no longer decays by itself — only a review clears it. */
export const GOLD_DECAY_APPEARANCES = 3;

/**
 * Most gold words allowed on screen in a single line, so a learner coming back
 * after a few days doesn't face a whole line of glitter at once. Extras render
 * plain green.
 */
export const MAX_GOLD_PER_LINE = 2;

/** The subset of a saved word this module needs. */
export interface GoldCandidate {
  id: string;
  state: string;
  next_review?: string | null;
  interval_days?: number | null;
  review_count?: number | null;
  state_changed_at?: string | null;
  created_at?: string | null;
  green_revealed_at?: string | null;
}

/** True when a word is green and its review is due — it shows GOLD. */
export function isPendingGreen(word: GoldCandidate | undefined | null): boolean {
  return isDueGold(word);
}

/**
 * Tap a gold word in a video: it turns green on screen (we remember the tap in
 * green_revealed_at), but it is NOT a review — it stays due in flashcards until
 * it's actually reviewed. Returns false when it wasn't gold (no double XP).
 */
export async function revealGreenWord(
  wordId: string,
): Promise<{ revealed: boolean; awardedXp: number }> {
  const { data: row, error: readError } = await supabase
    .from("saved_words")
    .select("id, state, next_review, interval_days, state_changed_at, green_revealed_at")
    .eq("id", wordId)
    .maybeSingle();
  if (readError || !row || !isDueGold(row as GoldCandidate)) return { revealed: false, awardedXp: 0 };

  const { error } = await supabase
    .from("saved_words")
    .update({ green_revealed_at: new Date().toISOString() } as any)
    .eq("id", wordId);
  if (error) {
    console.error("[goldenReveal] tap failed", error);
    return { revealed: false, awardedXp: 0 };
  }
  return { revealed: true, awardedXp: GOLD_CLAIM_XP };
}

/** No-op: gold no longer burns off by itself. Kept so older callers compile. */
export async function touchGoldWord(_wordId: string): Promise<void> {}

/** Gold is a reward colour, deliberately outside the red/orange/green deck set. */
export const GOLD = {
  core: "#FFD54A",
  deep: "#FFAA1A",
  glow: "rgba(255, 200, 60, 0.55)",
} as const;
