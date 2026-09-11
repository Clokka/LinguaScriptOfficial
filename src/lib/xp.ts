// MOTIVATION LAYER — must not import SRS modules (vocab.ts, etc.).
// XP is a pure motivation/dopamine layer. It never reads or writes
// saved_words.state, deck transitions, or activity streaks.

import { supabase } from "@/integrations/supabase/client";

export type XpAction =
  | "add_word"
  | "review_card"
  | "session_end"
  | "video_watch"
  | "reinforcement"
  | "line_blast";

/**
 * XP for one completed line, before the combo multiplier.
 *
 * The Line Blast displays "+45 XP (15 x 3)" and the learner is meant to chase
 * that multiplier, so the grant has to be the number on screen — award this
 * once per combo step. It lives here rather than in the UI layer because the
 * XP system is the authority on what an action is worth; lineBlast.ts
 * re-exports it as BASE_XP so the label and the grant cannot drift.
 */
export const LINE_BLAST_XP = 15;

export interface XpMeta {
  correct?: boolean;
  cards?: number;
  videoId?: string;
}

// Front-loaded onboarding ramp — levels 1-5, unchanged.
//
// The old curve started at 100 XP for level 2. A first session — save one word
// (20) and review three cards (30) — totalled 50, so a new learner finished
// onboarding having never levelled up once. The single most motivating moment
// in the product was unreachable on day one.
//
// These thresholds are tuned against the real action values in xpForAction:
//   save first word            20  -> level 2   (instant, before they scroll)
//   + three correct reviews    50  -> level 3
const EARLY_RAMP = [0, 20, 50, 95, 160];

// The 30-day "hooked" ramp — levels 6-30.
//
// Baseline persona: a learner doing nothing but hitting the Recommended
// 5-word/day goal (5 x 20 XP = 100 XP/day guaranteed, before any reviews or
// session bonus). Gaps grow gently — 4%/level, 100 XP to ~256 XP — so a
// level-up lands roughly once a day across the whole 30-day window for a
// learner near that baseline, faster for anyone reviewing cards too. This
// is the actual retention lever: dense reinforcement while the habit is
// still forming, not a flat "everyone gets a level every N XP" grind.
//
// Also lines up level 25 (a milestoneTier "grand" — +250 bonus gems, see
// levelRewards.ts) right near the end of this window, not buried decades
// away like it would be under the endless curve alone.
//
// After level 30 the endless curve below takes over and progression
// deliberately slows down — dense to build the habit, a real climb once
// it's established. That's the "then slow down" half of the design, not
// an accident of the math running out.
const DENSE_RAMP_LEVELS = 25; // levels 6 through 30
const DENSE_RAMP_BASE_GAP = 100;
const DENSE_RAMP_GROWTH = 1.04;

function buildFrontRamp(): number[] {
  const thresholds = [...EARLY_RAMP];
  let gap = DENSE_RAMP_BASE_GAP;
  for (let i = 0; i < DENSE_RAMP_LEVELS; i++) {
    thresholds.push(thresholds[thresholds.length - 1] + Math.round(gap));
    gap *= DENSE_RAMP_GROWTH;
  }
  return thresholds;
}

// NOTE: changing this ramp means existing accounts jump (or, if ever made
// stingier, don't retroactively drop) several levels the next time they
// load. A jump is a pleasant surprise rather than a regression, and
// sync_level_rewards is idempotent server-side so the gems for those levels
// are granted once, not re-granted.
export const LEVEL_THRESHOLDS = buildFrontRamp();

// Endless progression past the ramp: each level costs a little more than the
// last, easing to a flat cost so high levels stay reachable. The final dense-
// ramp gap (level 29->30) lands around 256 XP; starting endless at 600 is a
// deliberate step up — leaving the ramp should read as "this is the real
// climb now," not go unnoticed.
const ENDLESS_BASE_GAP = 600;
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
    case "line_blast":
      return LINE_BLAST_XP;
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
