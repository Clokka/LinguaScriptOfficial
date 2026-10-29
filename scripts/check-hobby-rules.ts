import assert from "node:assert/strict";
import { MAX_INTERESTS, INTERESTS, interestQueries } from "../src/lib/interests";
import { popularityScore } from "../src/lib/videoPopularity";
import { isRecommended, COVERAGE } from "../src/lib/coverage";

assert.equal(MAX_INTERESTS, 1, "one onboarding hobby");
assert.equal(interestQueries(INTERESTS.find((i) => i.id === "travel") ?? INTERESTS[0], "fr", "French")[0], "vlog voyage");
assert.ok(popularityScore({ viewCount: 1_000_000, likeCount: 50_000 }) > popularityScore({ viewCount: 1_000_000, likeCount: 1_000 }), "likes/views matters at equal audience size");
assert.ok(popularityScore({ viewCount: 1_000_000, likeCount: 50_000 }) > popularityScore({ viewCount: 10_000, likeCount: 500 }), "views matter at equal engagement rate");
assert.equal(isRecommended(COVERAGE.MIN), true);
assert.equal(isRecommended(COVERAGE.MIN - 0.1), false);
console.log("Hobby and popularity rules passed");