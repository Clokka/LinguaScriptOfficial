import assert from "node:assert/strict";
import { shouldAwardPracticeProgress } from "../src/lib/practiceProgress";
assert.equal(shouldAwardPracticeProgress(false), false, "School previews never award learner progress");
assert.equal(shouldAwardPracticeProgress(true), true, "Actual phrase practice retains progress awards");
console.log("Preview and real practice progress rules passed");