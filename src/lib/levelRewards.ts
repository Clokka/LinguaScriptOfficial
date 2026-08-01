// MOTIVATION LAYER — deterministic level rewards.
//
// Every level pays out, and the payout is FIXED, never random: a learner can
// always see exactly what the next level gives them. (Random level chests are
// the pattern Supercell unwound in Clash Royale's 2025 progression rework
// because players could no longer tell how fast they were progressing.)
//
// Gems are cosmetic-only currency. They must never buy vocabulary, XP boosts
// or anything that changes learning outcomes.

import { PETS, type PetMeta } from "@/lib/pets";

/**
 * Gems granted for reaching `level`.
 * MUST stay identical to public.level_reward_gems() in
 * supabase/migrations/20260801120000_level_rewards.sql — the database is
 * authoritative for the balance; this copy drives the UI.
 */
export function gemsForLevel(level: number): number {
  if (!Number.isFinite(level) || level < 2) return 0;
  const n = Math.floor(level);
  return (
    25 + (n % 5 === 0 ? 100 : 0) + (n % 25 === 0 ? 250 : 0)
  );
}

export type MilestoneTier = "level" | "major" | "grand";

export function milestoneTier(level: number): MilestoneTier {
  if (level % 25 === 0) return "grand";
  if (level % 5 === 0) return "major";
  return "level";
}

export interface LevelReward {
  level: number;
  gems: number;
  tier: MilestoneTier;
  /** Short line shown under the level-up headline. */
  blurb: string;
}

export function rewardForLevel(level: number): LevelReward {
  const gems = gemsForLevel(level);
  const tier = milestoneTier(level);
  const blurb =
    tier === "grand"
      ? "Grand milestone — a big gem haul."
      : tier === "major"
        ? "Milestone level — bonus gems."
        : "Every level pays out.";
  return { level, gems, tier, blurb };
}

/** Total gems a learner will have earned by the time they reach `level`. */
export function cumulativeGems(level: number): number {
  let total = 0;
  for (let n = 2; n <= level; n++) total += gemsForLevel(n);
  return total;
}

/**
 * The cheapest gem-locked pet the learner cannot afford yet — gives the gem
 * balance an immediate, concrete purpose instead of being an abstract number.
 */
export function nextGemUnlock(
  gems: number,
  ownedPetIds: string[] = [],
): { pet: PetMeta; cost: number; remaining: number } | null {
  const candidates = PETS.filter(
    (p) => p.unlock.type === "gems" && !ownedPetIds.includes(p.id),
  ).sort(
    (a, b) =>
      (a.unlock as { amount: number }).amount -
      (b.unlock as { amount: number }).amount,
  );

  for (const pet of candidates) {
    const cost = (pet.unlock as { amount: number }).amount;
    if (gems < cost) return { pet, cost, remaining: cost - gems };
  }
  return null;
}
