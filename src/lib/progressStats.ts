// Pure functions for the LinguaScript progress dashboard.
// No DB calls here — keep this trivially testable.

export type MemoryStage = "short" | "medium" | "long";

export interface SavedWordLite {
  review_count: number;
}

export interface ActivityDayLite {
  date: string; // YYYY-MM-DD
  minutes_watched: number;
  videos_watched: number;
  words_reviewed?: number;
  goal_met?: boolean;
}

export function memoryStage(reviewCount: number): MemoryStage {
  if (reviewCount <= 1) return "short";
  if (reviewCount <= 3) return "medium";
  return "long";
}

export function stageCounts(words: SavedWordLite[]) {
  const counts = { short: 0, medium: 0, long: 0 } as Record<MemoryStage, number>;
  for (const w of words) counts[memoryStage(w.review_count)]++;
  return counts;
}

/** % of words in medium or long-term memory. 0 if no words. */
export function retentionStrength(words: SavedWordLite[]): number {
  if (words.length === 0) return 0;
  const c = stageCounts(words);
  return Math.round(((c.medium + c.long) / words.length) * 100);
}

export function avgWordsPerDay(activity: ActivityDayLite[], days = 30): number {
  if (days <= 0) return 0;
  const total = activity.reduce((sum, d) => sum + (d.words_reviewed ?? 0), 0);
  return Math.round((total / days) * 10) / 10;
}

export function projectedYearlyVocab(avgPerDay: number): number {
  return Math.round(avgPerDay * 365);
}

export function watchTimeThisWeek(activity: ActivityDayLite[]): number {
  const now = new Date();
  const start = new Date(now);
  start.setDate(now.getDate() - 6);
  const startStr = start.toISOString().split("T")[0];
  return activity
    .filter((d) => d.date >= startStr)
    .reduce((sum, d) => sum + (d.minutes_watched ?? 0), 0);
}

/**
 * Legacy: the daily goal used to be a video count, which derived a word target.
 *
 * @deprecated The learner now picks words directly — see WORD_GOAL_PRESETS. Kept
 * so profiles saved before that change still resolve to a sensible number.
 */
export function wordGoalForVideos(videoGoal: number): number {
  if (videoGoal <= 1) return 10;
  if (videoGoal === 2) return 20;
  return 40;
}

/**
 * Watch-time expectation implied by a word goal.
 *
 * The relationship runs the other way now, but daily_video_goal still feeds the
 * watch-time stat, so a word goal needs to imply one rather than the reverse.
 */
export function videoGoalForWords(wordGoal: number): number {
  return wordGoal >= 8 ? 2 : 1;
}

/** Daily goal -> watch-time target in minutes (assumes ~10 min/video). */
export function minuteGoalForVideos(videoGoal: number): number {
  return videoGoal * 10;
}

/**
 * The daily goal, in words.
 *
 * It used to be a video count (1/2/3) which silently derived 10/20/40 words.
 * Nobody chose 40; it fell out of a function, and a goal that gets missed twice
 * teaches the learner they fail at this app. A goal's job is to be met — it has
 * to survive a bad day, because bad days are where retention is won or lost.
 *
 * Serious learners overshoot regardless. What the low floor changes is what
 * happens on the days they nearly don't show up.
 */
export const WORD_GOAL_PRESETS = [
  {
    words: 1,
    perYear: "365",
    label: "Gentle",
    milestone: "The floor. A bad day still counts \u2014 ninety seconds and the streak lives.",
  },
  {
    words: 5,
    perYear: "1,825",
    label: "Recommended",
    milestone: "Roughly the vocabulary gap between B1 and B2, in a year.",
  },
  {
    words: 8,
    perYear: "2,920",
    label: "Ambitious",
    milestone: "For when you have already proved you will show up.",
  },
] as const;

export const DEFAULT_WORD_GOAL = 5;

/**
 * Coerce a stored goal onto the current scale.
 *
 * Profiles written before the switch hold 10, 20 or 40 — numbers derived from a
 * video count, not chosen by anyone. Left alone they match no preset, so the
 * picker highlights nothing and the streak copy quotes a target that isn't on
 * offer. Snapping them to the recommended default is honest precisely because
 * the old value was never a decision.
 */
export function normalizeWordGoal(stored: number | null | undefined): number {
  const presets = WORD_GOAL_PRESETS.map((p) => p.words) as readonly number[];
  if (stored != null && presets.includes(stored)) return stored;
  return DEFAULT_WORD_GOAL;
}

/** @deprecated Superseded by WORD_GOAL_PRESETS. Retained for old profiles. */
export const VIDEO_GOAL_PRESETS = [
  {
    videos: 1,
    wordsPerDay: "10–20",
    wordsPerYear: "3,650–7,300",
    milestone: "Understand lots of daily French conversation.",
  },
  {
    videos: 2,
    wordsPerDay: "20–40",
    wordsPerYear: "7,300–14,600",
    milestone: "Strong conversational fluency.",
  },
  {
    videos: 3,
    wordsPerDay: "40+",
    wordsPerYear: "14,000+",
    milestone: "Near-native comprehension acceleration.",
  },
] as const;
