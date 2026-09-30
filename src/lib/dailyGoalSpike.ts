// MOTIVATION LAYER — how big today's daily-goal celebration should feel.
//
// This never touches the reward itself: gems stay exactly what
// levelRewards.ts's deterministic gemsForLevel() says they are, on every
// level, always (see that file's own comment on why random rewards are a
// mistake). Intensity here is purely cosmetic — confetti, copy, duration —
// layered on top of a payout the learner can always predict.
//
// Combines two signals on purpose: a streak milestone is a real, legible
// reason today is a bigger deal (day 5, day 25, ...), and a small random
// chance of a surprise on an ordinary day keeps the "come back tomorrow to
// see" pull alive even between milestones.
export type SpikeIntensity = "normal" | "big" | "massive";

const RANDOM_BIG_CHANCE = 1 / 6;

export function dailyGoalSpikeIntensity(streakCount: number): SpikeIntensity {
  if (streakCount > 0 && streakCount % 25 === 0) return "massive";
  if (streakCount > 0 && streakCount % 5 === 0) return "big";
  if (Math.random() < RANDOM_BIG_CHANCE) return "big";
  return "normal";
}
