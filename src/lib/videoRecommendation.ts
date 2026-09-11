// Real per-user comprehension scoring for candidate YouTube videos, run
// BEFORE a video is ever imported into the catalog. youtube-search already
// filters out Shorts, caption-less videos, kids' content and low-engagement
// junk server-side (cheap, metadata-only); this is the second stage —
// fetching real captions client-side (free, no API quota — the same
// DownSub-style fetch the Watch page uses) and scoring them against the
// learner's actual saved-word deck, the same way an already-imported video's
// comprehension is scored.
import { fetchCaptionsFromBrowser } from "@/lib/browserCaptionFetcher";
import { tokenize, learningZone, type LearningZone } from "@/lib/understanding";
import { scoreTokens } from "@/lib/videoComprehension";
import { loadDeckIndex, type SavedWordLite } from "@/lib/vocab";

/**
 * Target comprehension band: 95-98% known words (2-5% unknown). This is the
 * research-backed "smooth comprehension" range (Hu & Nation 2000 for
 * reading; van Zeeland & Schmitt 2013 for listening) rather than a looser
 * 10-20%-unknown guess — below ~95% known, sentence-level parsing starts
 * getting effortful rather than just individual-word gaps.
 */
export const IDEAL_MIN = 95;
export const IDEAL_MAX = 98;

export interface ScoredCandidate {
  videoId: string;
  /** null = captions couldn't be fetched/parsed — never shown as "scored". */
  comprehensionPct: number | null;
  zone: LearningZone | null;
}

/** 0 inside the ideal band, otherwise how far outside it (either direction). */
export function distanceFromIdeal(pct: number): number {
  if (pct < IDEAL_MIN) return IDEAL_MIN - pct;
  if (pct > IDEAL_MAX) return pct - IDEAL_MAX;
  return 0;
}

/** Score one candidate video against a learner's real known-word deck. */
export async function scoreCandidate(
  videoId: string,
  learningLang: string,
  nativeLang: string,
  deck: Map<string, SavedWordLite>,
): Promise<ScoredCandidate> {
  try {
    const { learning } = await fetchCaptionsFromBrowser(videoId, learningLang, nativeLang);
    if (learning.length === 0) {
      return { videoId, comprehensionPct: null, zone: null };
    }
    const tokens = learning.flatMap((seg) => tokenize(seg.text));
    if (tokens.length === 0) return { videoId, comprehensionPct: null, zone: null };
    const { pct } = scoreTokens(tokens, learningLang, deck);
    return { videoId, comprehensionPct: pct, zone: learningZone(pct) };
  } catch (err) {
    console.error("scoreCandidate failed:", err);
    return { videoId, comprehensionPct: null, zone: null };
  }
}

export interface RankedCandidate<T> {
  item: T;
  comprehensionPct: number;
  zone: LearningZone;
}

/**
 * Rank already metadata-filtered candidates by real comprehension, closest
 * to the ideal band first. Drops anything that couldn't be scored — an
 * unscored video defeats the entire point of difficulty-matching, so it's
 * better absent than shown with a guess.
 *
 * `maxToScore` caps how many candidates fetch captions (each is a real
 * network round-trip to YouTube from the browser) — score the metadata-
 * filtered short-list, not the whole rail.
 */
export async function rankByComprehension<T extends { videoId: string }>(
  candidates: T[],
  learningLang: string,
  nativeLang: string,
  userId: string | null,
  maxToScore = 10,
): Promise<RankedCandidate<T>[]> {
  if (candidates.length === 0) return [];
  const deck = await loadDeckIndex(userId, learningLang);
  const pool = candidates.slice(0, maxToScore);
  const scored = await Promise.all(
    pool.map(async (item) => ({ item, score: await scoreCandidate(item.videoId, learningLang, nativeLang, deck) })),
  );
  const usable = scored
    .filter((s): s is { item: T; score: ScoredCandidate & { comprehensionPct: number; zone: LearningZone } } =>
      s.score.comprehensionPct !== null && s.score.zone !== null,
    )
    .map((s) => ({ item: s.item, comprehensionPct: s.score.comprehensionPct, zone: s.score.zone }));
  usable.sort((a, b) => distanceFromIdeal(a.comprehensionPct) - distanceFromIdeal(b.comprehensionPct));
  return usable;
}
