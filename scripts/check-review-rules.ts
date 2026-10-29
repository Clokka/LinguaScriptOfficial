/**
 * npm run test:review
 *
 * Checks the ONE review ladder (packages/core/src/review.ts) gives the
 * expected answers, and that the Chrome extension's copy in
 * extension/background.js (plain JS, no build step) colours words exactly
 * the same way. Run it after touching either file.
 */
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import {
  nextReviewInterval, isDueGold, displayState, reviewDueAt, promote, dateInDays, todayLocal,
  type ReviewFields,
} from "../packages/core/src/review";

let passed = 0;
const check = (name: string, fn: () => void) => {
  try { fn(); passed++; } catch (e) { console.error(`✗ ${name}`); throw e; }
};

// 1. The ladder: green → 0 (5 min) → 1 → 3 → 7 → 14 → 30 → 45 → 68 …
check("ladder", () => {
  assert.equal(nextReviewInterval(null, true, false, true), 0);
  const steps: number[] = [];
  let i = 0;
  for (let n = 0; n < 8; n++) { i = nextReviewInterval(i, true, true, true); steps.push(i); }
  assert.deepEqual(steps, [1, 3, 7, 14, 30, 45, 68, 102]);
  assert.equal(nextReviewInterval(30, false, true, true), 1);
  assert.equal(nextReviewInterval(3, true, false, false), 1);
});

check("forward only", () => {
  assert.equal(promote("red", true), "orange");
  assert.equal(promote("orange", true), "green");
  assert.equal(promote("green", false), "green");
  assert.equal(promote("red", false), "red");
});

check("dates", () => {
  assert.match(todayLocal(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dateInDays(1, new Date(2026, 11, 31)), "2027-01-01");
});

// 2. Gold rules, and the extension agrees on every case.
const now = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const MIN = 60_000, DAY = 86_400_000;
const cases: [string, ReviewFields, "red" | "orange" | "green" | "gold"][] = [
  ["red word", { state: "red" }, "red"],
  ["orange word", { state: "orange", next_review: dateInDays(-3) }, "orange"],
  ["just green, 2 min ago", { state: "green", interval_days: 0, state_changed_at: iso(now - 2 * MIN) }, "green"],
  ["just green, 6 min ago → gold", { state: "green", interval_days: 0, state_changed_at: iso(now - 6 * MIN) }, "gold"],
  ["tapped after due → green", { state: "green", interval_days: 0, state_changed_at: iso(now - 6 * MIN), green_revealed_at: iso(now - MIN) }, "green"],
  ["tapped before due → gold", { state: "green", interval_days: 0, state_changed_at: iso(now - 6 * MIN), green_revealed_at: iso(now - 10 * MIN) }, "gold"],
  ["due yesterday → gold", { state: "green", interval_days: 3, next_review: dateInDays(-1) }, "gold"],
  ["due tomorrow → green", { state: "green", interval_days: 3, next_review: dateInDays(1) }, "green"],
  ["green, no date", { state: "green", interval_days: 7 }, "green"],
  ["junk state → red", { state: "purple" }, "red"],
];

check("core gold", () => {
  for (const [name, row, want] of cases) assert.equal(displayState(row, now), want, name);
  assert.equal(isDueGold({ state: "green", interval_days: 0, state_changed_at: iso(now - DAY) }, now), true);
  assert.equal(reviewDueAt({ state: "red" }), null);
});

// Pull coerceState / reviewDueAt / deckState out of the extension and run them.
const bg = readFileSync(new URL("../extension/background.js", import.meta.url), "utf8");
const start = bg.indexOf("function coerceState(");
const end = bg.indexOf("// If a word has more than one row");
assert.ok(start > 0 && end > start, "couldn't find deckState() in extension/background.js — update this script if it moved");
const extDeckState = new Function(`${bg.slice(start, end)}; return deckState;`)() as (row: ReviewFields, now?: number) => string;

check("extension matches core", () => {
  for (const [name, row] of cases) assert.equal(extDeckState(row, now), displayState(row, now), `extension differs: ${name}`);
});

console.log(`✓ review rules OK (${passed} checks, ${cases.length} gold cases, extension in sync)`);
