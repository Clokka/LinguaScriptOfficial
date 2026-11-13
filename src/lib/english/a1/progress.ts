// A1 progress on this device (localStorage "ls.a1.v1"), like French Fast Track
// (ls.cognates.fr). No database table, so nothing to migrate.
import { UNITS, PASS_SCORE } from "./grammar";
import { TOP_100 } from "./words";
import { CHECK_IDS } from "./checklist";

export interface A1Progress { units: Record<string, number>; known: string[]; checks: string[]; test?: { score: number; at: string } }
const KEY = "ls.a1.v1";
/** The CEFR sets no official word count. Courses and exams usually expect about
 *  400–700 words at A1; "A1 ready %" uses the top of that range. Step 1 ships the
 *  first 100 (the most frequent); the rest come by topic (plan §3b). */
export const A1_WORD_RANGE = "400–700";
export const A1_WORD_TARGET = 700;

export function loadA1(): A1Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "{}");
    return { units: raw.units || {}, known: Array.isArray(raw.known) ? raw.known : [], checks: Array.isArray(raw.checks) ? raw.checks : [], test: raw.test };
  } catch { return { units: {}, known: [], checks: [] }; }
}
export function saveA1(p: A1Progress) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: progress just isn't kept */ }
}
export const unitsPassed = (p: A1Progress) => UNITS.filter((u) => (p.units[u.slug] ?? 0) >= PASS_SCORE).length;
export const wordsKnown = (p: A1Progress) => p.known.filter((w) => TOP_100.some((x) => x.w === w)).length;

export const checksDone = (p: A1Progress) => p.checks.filter((id) => CHECK_IDS.includes(id)).length;

/** "A1 ready %": one third each — grammar (20 units), words (of 700), "I can…" checklist. */
export function a1Ready(p: A1Progress): number {
  const g = unitsPassed(p) / UNITS.length;
  const w = Math.min(wordsKnown(p), A1_WORD_TARGET) / A1_WORD_TARGET;
  const c = checksDone(p) / CHECK_IDS.length;
  return Math.round(((g + w + c) / 3) * 100);
}
