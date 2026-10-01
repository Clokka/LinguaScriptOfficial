// THE single source of truth for comprehensible-input thresholds.
// Vocabulary coverage = % of a video's real transcript words the learner
// already knows (scored against their own deck, never CEFR alone).
// Do not define coverage cut-offs anywhere else in the app.

export const COVERAGE = { IDEAL: 98, MIN: 95, STRETCH: 90 } as const;

export type CoverageTier = "ideal" | "good" | "challenging" | "too-hard";

export function coverageTier(pct: number): CoverageTier {
  if (pct >= COVERAGE.IDEAL) return "ideal";
  if (pct >= COVERAGE.MIN) return "good";
  if (pct >= COVERAGE.STRETCH) return "challenging";
  return "too-hard";
}

/** Recommendable as standard comprehensible input (95%+). */
export const isRecommended = (pct: number) => pct >= COVERAGE.MIN;
/** Shown at all (stretch allowed when space remains); under 90% is not. */
export const isShowable = (pct: number) => pct >= COVERAGE.STRETCH;

export const TIER_DOT: Record<CoverageTier, string> = {
  ideal: "🟢", good: "🟢", challenging: "🟠", "too-hard": "🔴",
};
export const TIER_LABEL: Record<CoverageTier, string> = {
  ideal: "Ideal for you",
  good: "Recommended",
  challenging: "Challenging",
  "too-hard": "Too difficult for now",
};
export const TIER_CLASS: Record<CoverageTier, string> = {
  ideal: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  good: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  challenging: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  "too-hard": "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

/** "🟢 96% vocabulary coverage" — never claims literal understanding. */
export function coverageBadge(pct: number): string {
  return `${TIER_DOT[coverageTier(pct)]} ${Math.round(pct)}% vocabulary coverage`;
}

/** Lower = better. Prefer ~98%, then 95–98, then 90–95, then the rest. */
export function rankScore(pct: number): number {
  const t = coverageTier(pct);
  const bucket = t === "ideal" ? 0 : t === "good" ? 1 : t === "challenging" ? 2 : 3;
  return bucket * 100 + Math.abs(COVERAGE.IDEAL - pct);
}

export function coverageMessage(pct: number): string {
  switch (coverageTier(pct)) {
    case "ideal": return "Ideal comprehensible input: you know almost every word in this video.";
    case "good": return "Good comprehensible input: a few new words to learn in context.";
    case "challenging": return "Challenging: you'll meet a lot of new words. Save some and rewatch.";
    default: return "Too difficult for now. Learn more words and it'll come back as a recommendation.";
  }
}
