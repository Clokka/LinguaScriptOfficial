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

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500,
];

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
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  }
  const idx = Math.min(level - 1, LEVEL_THRESHOLDS.length - 1);
  const floor = LEVEL_THRESHOLDS[idx];
  const ceil =
    LEVEL_THRESHOLDS[idx + 1] ??
    LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 2500;
  return { level, current: xp - floor, nextLevelXP: ceil - floor };
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
