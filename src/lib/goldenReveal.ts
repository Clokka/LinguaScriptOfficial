import { supabase } from "@/integrations/supabase/client";

/**
 * The Golden Reveal — the transient state a word passes through on its way
 * into the green deck.
 *
 *   red     never met it
 *   orange  learning
 *   GOLD    promoted to green, but the learner hasn't witnessed it yet
 *   green   known, and seen to be known
 *
 * Gold is a reward to be claimed, not a status: it appears once per promotion
 * and is spent by clicking it. This module is the single source of truth for
 * "is this word gold" so the player, the demo and the extension can't drift.
 */

/** XP for claiming a gold word. Auto-revealed words award nothing. */
export const GOLD_CLAIM_XP = 5;

/**
 * A gold word auto-reveals after appearing in this many subtitle lines.
 *
 * Three, not five: if a learner has scrolled past it three times the effect
 * has already become wallpaper, and more chances only prove it isn't landing.
 */
export const GOLD_DECAY_APPEARANCES = 3;

/**
 * Most gold words allowed on screen in a single line.
 *
 * This is the setting that actually protects the feeling. Without it, a
 * learner who reviews thirty words and then opens the player days later gets
 * thirty gold words and thirty pending jingles at once — a per-word decay
 * cap does nothing about that. Extras render plain green and are revealed
 * silently.
 */
export const MAX_GOLD_PER_LINE = 2;

/** The subset of a saved word this module needs. */
export interface GoldCandidate {
  id: string;
  state: string;
  state_changed_at?: string | null;
  created_at?: string | null;
  /**
   * `undefined` and `null` mean different things here and the distinction is
   * load-bearing — see `isPendingGreen`.
   */
  green_revealed_at?: string | null;
}

/**
 * True when a word is green in the deck but the learner hasn't seen it turn.
 *
 * Compares against `state_changed_at` rather than a boolean flag so a word
 * that drops back to orange and is re-promoted re-arms the gold.
 *
 * The `undefined` case is the safety catch: the deck loader omits
 * `green_revealed_at` entirely when the Golden Reveal migration hasn't run, and
 * without this check every green word in the database would light up gold at
 * once — each one clicking through to an RPC that doesn't exist, so the gold
 * would never burn off. Absent column means no gold; `null` means a real,
 * unclaimed promotion.
 */
export function isPendingGreen(word: GoldCandidate | undefined | null): boolean {
  if (!word || word.state !== "green") return false;
  if (word.green_revealed_at === undefined) return false;
  if (word.green_revealed_at === null) return true;

  const promoted = word.state_changed_at ?? word.created_at;
  if (!promoted) return false;

  return new Date(word.green_revealed_at).getTime() < new Date(promoted).getTime();
}

/**
 * Claim a gold word. Returns whether this call was the one that claimed it —
 * false means it was already claimed, and the caller must not play the chime
 * or award XP again.
 */
export async function revealGreenWord(
  wordId: string,
): Promise<{ revealed: boolean; awardedXp: number }> {
  const { data, error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )("reveal_green_word", { p_word_id: wordId });

  if (error) {
    console.error("[goldenReveal] claim failed", error);
    return { revealed: false, awardedXp: 0 };
  }

  const row = data as { revealed?: boolean; awarded_xp?: number } | null;
  return { revealed: !!row?.revealed, awardedXp: row?.awarded_xp ?? 0 };
}

/**
 * Record that a gold word appeared in another line, auto-claiming it once it
 * has been ignored `GOLD_DECAY_APPEARANCES` times.
 *
 * Callers MUST debounce this to one call per subtitle-line occurrence. React
 * re-renders would otherwise drive the count past the threshold within a
 * second and auto-claim every gold word before it was ever seen — see
 * `seenLineKeysRef` in SubtitleOverlay.
 */
export async function touchGoldWord(wordId: string): Promise<void> {
  const { error } = await (
    supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  )("touch_gold_word", { p_word_id: wordId, p_decay_at: GOLD_DECAY_APPEARANCES });

  if (error) console.error("[goldenReveal] touch failed", error);
}

/** Gold is a reward colour, deliberately outside the red/orange/green deck set. */
export const GOLD = {
  core: "#FFD54A",
  deep: "#FFAA1A",
  glow: "rgba(255, 200, 60, 0.55)",
} as const;
