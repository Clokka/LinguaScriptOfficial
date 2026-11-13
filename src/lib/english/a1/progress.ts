// A1 progress on this device (localStorage "ls.a1.v1"), like French Fast Track
// (ls.cognates.fr). No database table, so nothing to migrate.
import { UNITS, PASS_SCORE } from "./grammar";
import { TOP_100 } from "./words";

export interface A1Progress { units: Record<string, number>; known: string[]; test?: { score: number; at: string } }
const KEY = "ls.a1.v1";
/** The CEFR sets no official word count. Courses and exams usually expect about
 *  400–700 words at A1; "A1 ready %" uses the top of that range. Step 1 ships the
 *  first 100 (the most frequent); the rest come by topic (plan §3b). */
export const A1_WORD_RANGE = "400–700";
export const A1_WORD_TARGET = 700;

export function loadA1(): A1Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { units: raw.units || {}, known: Array.isArray(raw.known) ? raw.known : [], test: raw.test };
  } catch { return { units: {}, known: [] }; }
}
export function saveA1(p: A1Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: progress just isn't kept */ }
}
export const unitsPassed = (p: A1Progress) => UNITS.filter((u) => (p.units[u.slug] ?? 0) >= PASS_SCORE).length;
export const wordsKnown = (p: A1Progress) => p.known.filter((w) => TOP_100.some((x) => x.w === w)).length;

/** "A1 ready %": half grammar (20 units), half words (700). */
export function a1Ready(p: A1Progress): number {
  return Math.round(((unitsPassed(p) / UNITS.length) * 0.5 + (Math.min(wordsKnown(p), A1_WORD_TARGET) / A1_WORD_TARGET) * 0.5) * 100);
}
