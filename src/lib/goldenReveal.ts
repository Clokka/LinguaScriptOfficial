import { supabase } from "@/integrations/supabase/client";
import { applySrsReview, isDueGold, todayLocal } from "@/lib/vocab";

/**
 * GOLD — a green word whose review is due.
 *
 *   red     never met it
 *   orange  learning
 *   green   known
 *   GOLD    known, and due for its next review (1, 3, 7, 14, 30 days, then ×1.5)
 *
 * Reviewing it — in flashcards, or by tapping it when it glows in a video —
 * sends it back to green until the next rung of the ladder. This module is the
 * single source of truth for "is this word gold" on the website, matching
 * `deckState()` in extension/background.js.
 */

/** XP for reviewing a gold word by tapping it in a video. */
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
 * Review a gold word straight from the video: the learner recognised it, so it
 * climbs one rung and goes back to green. Returns whether this call did the
 * review — false means it was already reviewed (no double XP on a double tap).
 */
export async function revealGreenWord(
  wordId: string,
): Promise<{ revealed: boolean; awardedXp: number }> {
  const { data: row, error: readError } = await supabase
    .from("saved_words")
    .select("id, state, next_review, interval_days, review_count, ease_factor")
    .eq("id", wordId)
    .maybeSingle();
  if (readError || !row || !isDueGold(row as GoldCandidate)) return { revealed: false, awardedXp: 0 };

  const srs = applySrsReview(row as any, true, { wasGreen: true, isGreen: true });
  const { data, error } = await supabase
    .from("saved_words")
    .update({ ...srs, green_revealed_at: new Date().toISOString() } as any)
    .eq("id", wordId)
    .lte("next_review", todayLocal())
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("[goldenReveal] review failed", error);
    return { revealed: false, awardedXp: 0 };
  }
  return { revealed: !!data, awardedXp: data ? GOLD_CLAIM_XP : 0 };
}

/** No-op: gold no longer burns off by itself. Kept so older callers compile. */
export async function touchGoldWord(_wordId: string): Promise<void> {}

/** Gold is a reward colour, deliberately outside the red/orange/green deck set. */
export const GOLD = {
  core: "#FFD54A",
  deep: "#FFAA1A",
  glow: "rgba(255, 200, 60, 0.55)",
} as const;
