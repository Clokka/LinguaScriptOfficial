/**
 * A different celebration for every level on the way to 10.
 *
 * The onboarding ramp is front-loaded (see LEVEL_THRESHOLDS in xp.ts) so a new
 * learner levels up on their very first saved word and again after their first
 * few reviews. If all nine of those level-ups played the same animation the
 * ramp would feel like a progress bar rather than a series of moments, so each
 * one gets its own clip and its own confetti weight.
 *
 * Clip names come from the Quirky Series rig shared by every pet GLB —
 * Attack, Bounce, Clicked, Death, Eat, Fear, Fly, Hit, Idle_A/B/C, Jump, Roll,
 * Run, Sit, Spin, Swim, Walk. The negative ones (Death, Fear, Hit, Attack) are
 * deliberately unused: a level-up should never look like the pet got hurt.
 *
 * runStage() falls back to the loop clip when an intro clip is missing, so a
 * pet whose rig lacks one of these still celebrates rather than freezing.
 */
export interface LevelCelebration {
  /** One-shot clip played on arrival, before settling into the loop. */
  intro: string;
  /** Looping clip held for the rest of the celebration. */
  loop: string;
  /** Confetti particles — climbs with the level so the ramp is visible. */
  particles: number;
  spread: number;
  /** Seconds the celebration holds before exiting. */
  hold: number;
  /** Shown under "Level N!" — names the moment instead of repeating the number. */
  caption: string;
}

const DEFAULT_LOOP = "Bounce";

/** Levels 2–10. Level 1 is the starting state and never celebrates. */
const RAMP: Record<number, LevelCelebration> = {
  2: { intro: "Bounce", loop: DEFAULT_LOOP, particles: 90, spread: 65, hold: 2.0, caption: "First word saved" },
  3: { intro: "Jump", loop: DEFAULT_LOOP, particles: 110, spread: 70, hold: 2.1, caption: "You're reviewing" },
  4: { intro: "Clicked", loop: DEFAULT_LOOP, particles: 130, spread: 75, hold: 2.2, caption: "Getting the hang of it" },
  5: { intro: "Spin", loop: DEFAULT_LOOP, particles: 160, spread: 85, hold: 2.5, caption: "Halfway to ten" },
  6: { intro: "Roll", loop: DEFAULT_LOOP, particles: 180, spread: 90, hold: 2.4, caption: "Rolling" },
  7: { intro: "Run", loop: DEFAULT_LOOP, particles: 200, spread: 95, hold: 2.5, caption: "Picking up speed" },
  8: { intro: "Eat", loop: DEFAULT_LOOP, particles: 220, spread: 100, hold: 2.6, caption: "Appetite for words" },
  9: { intro: "Fly", loop: DEFAULT_LOOP, particles: 250, spread: 110, hold: 2.8, caption: "Almost there" },
  10: { intro: "Spin", loop: DEFAULT_LOOP, particles: 320, spread: 130, hold: 3.4, caption: "Double figures" },
};

/** Everything past the ramp shares one solid celebration. */
const BEYOND: LevelCelebration = {
  intro: "Spin",
  loop: DEFAULT_LOOP,
  particles: 200,
  spread: 90,
  hold: 2.4,
  caption: "Level up",
};

export function celebrationForLevel(level: number): LevelCelebration {
  return RAMP[level] ?? BEYOND;
}

/** True while the learner is still inside the front-loaded onboarding ramp. */
export function isRampLevel(level: number): boolean {
  return level >= 2 && level <= 10;
}
