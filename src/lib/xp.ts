// MOTIVATION LAYER — must not import SRS modules (vocab.ts, etc.).
// XP is a pure motivation/dopamine layer. It never reads or writes
// saved_words.state, deck transitions, or activity streaks.

import { supabase } from "@/integrations/supabase/client";

export type XpAction =
  | "add_word"
  | "review_card"
  | "session_end"
  | "video_watch"
  | "reinforcement";

export interface XpMeta {
  correct?: boolean;
  cards?: number;
  videoId?: string;
}

// Hand-tuned early curve. Levels 1-10 keep these exact totals so no existing
// account's level shifts. Past level 10 the curve continues forever (see
// extendThresholds) — a fixed table capped heavy learners at level 10 with a
// progress bar that ran past 100% and no level-up could ever fire again.
export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500,
];

// Endless progression past the hand-tuned curve: each level costs a little
// more than the last, easing to a flat cost so high levels stay reachable.
const ENDLESS_BASE_GAP = 2500;
const ENDLESS_GROWTH = 1.08;
const ENDLESS_MAX_GAP = 25000;

const thresholds: number[] = [...LEVEL_THRESHOLDS];
let nextGap = ENDLESS_BASE_GAP;

/** Grow the threshold table until it strictly exceeds `xp`. */
function extendThresholds(xp: number) {
  while (thresholds[thresholds.length - 1] <= xp) {
    thresholds.push(thresholds[thresholds.length - 1] + Math.round(nextGap));
    nextGap = Math.min(nextGap * ENDLESS_GROWTH, ENDLESS_MAX_GAP);
  }
}

/** Total XP required to reach `level` (level 1 = 0 XP). */
export function xpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  while (thresholds.length < n) {
    thresholds.push(thresholds[thresholds.length - 1] + Math.round(nextGap));
    nextGap = Math.min(nextGap * ENDLESS_GROWTH, ENDLESS_MAX_GAP);
  }
  return thresholds[n - 1];
}

const GUEST_KEY = "linguascript.guestXP";

export function xpForAction(action: XpAction, meta: XpMeta = {}): number {
  switch (action) {
    case "add_word":
      return 20;
    case "review_card":
      return 5 + (meta.correct ? 5 : 0);
    case "video_watch":
      return 10;
    case "reinforcement":
      return 5;
    case "session_end": {
      const n = meta.cards ?? 0;
      if (n >= 10) return 25;
      if (n >= 5) return 10;
      return 0;
    }
  }
}

export function levelFromXP(xp: number): {
  level: number;
  current: number;
  nextLevelXP: number;
} {
  const total = Number.isFinite(xp) ? Math.max(0, Math.floor(xp)) : 0;
  extendThresholds(total);

  // Largest index whose threshold is <= total; that index + 1 is the level.
  let lo = 0;
  let hi = thresholds.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (thresholds[mid] <= total) lo = mid;
    else hi = mid - 1;
  }

  const floor = thresholds[lo];
  const ceil = thresholds[lo + 1];
  return { level: lo + 1, current: total - floor, nextLevelXP: ceil - floor };
}

export function getGuestXP(): number {
  try {
    return parseInt(localStorage.getItem(GUEST_KEY) || "0", 10) || 0;
  } catch {
    return 0;
  }
}

export function setGuestXP(xp: number) {
  try {
    localStorage.setItem(GUEST_KEY, String(xp));
  } catch {
    /* noop */
  }
}

export function clearGuestXP() {
  try {
    localStorage.removeItem(GUEST_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Grants every unclaimed level reward up to `level` and returns the new gem
 * balance. Idempotent server-side, so replaying it cannot double-pay.
 */
export async function syncLevelRewards(level: number): Promise<number | null> {
  const { data, error } = await (supabase as any).rpc("sync_level_rewards", {
    p_level: level,
  });
  if (error) {
    console.error("[xp] level reward sync failed", error);
    return null;
  }
  return typeof data === "number" ? data : null;
}

/**
 * Background persistence. Never blocks UI.
 * Caller already updated optimistic state in XpContext.
 */
export async function persistXP(
  userId: string,
  newTotal: number,
  newLevel: number,
  action: XpAction,
  amount: number,
  meta?: XpMeta,
) {
  void supabase
    .from("profiles")
    .update({ xp_total: newTotal, xp_level: newLevel } as any)
    .eq("user_id", userId)
    .then(({ error }) => {
      if (error) console.error("[xp] profile update failed", error);
    });
  void supabase
    .from("xp_events")
    .insert({
      user_id: userId,
      action,
      amount,
      meta: meta ?? null,
    } as any)
    .then(({ error }) => {
      if (error) console.error("[xp] event insert failed", error);
    });
}
