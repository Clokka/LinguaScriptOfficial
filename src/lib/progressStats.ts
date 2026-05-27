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

/** Daily goal -> derived word target. */
export function wordGoalForVideos(videoGoal: number): number {
  if (videoGoal <= 1) return 10;
  if (videoGoal === 2) return 20;
  return 40;
}

/** Daily goal -> watch-time target in minutes (assumes ~10 min/video). */
export function minuteGoalForVideos(videoGoal: number): number {
  return videoGoal * 10;
}

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
