# One 95–98% vocabulary-coverage rule + Spanish-only Continue Watching

## What I understood
1. Every video is scored against its real subtitles: the % of words in it you already know. One rule for the whole app:
   - 98%+ = ideal, strongly recommend
   - 95–97.9% = recommend
   - 90–94.9% = challenging (labelled, shown only as stretch)
   - under 90% = not normally recommended
   Never pick by CEFR level alone. Scores are recalculated as you learn, so hard videos become recommended later.
2. Label it "🟢 96% vocabulary coverage", not "understood", unless we have real viewing data.
3. On your Spanish account you see French recommendations, and Continue Watching shows a French video but not the Spanish one you watched.

## Audit findings
- **Why the Spanish video was missing:** Continue Watching only reads a "comprehension result" record, which gets saved only after a fuller watch is scored. Your three Spanish watches (Easy Spanish vlog, El Diario de Jonathan, Barcelona coffee) are in your watch history but have no result record, so they never show up.
- **Why the French video shows:** the rail never filters by language. It shows any video with a result record, and your only ones are French. It also hides any video scored 95% or above, so good matches disappear.
- **French recommendations:** the main catalogue list loads every public video without a language filter. The personalised rows do filter by language.
- **Thresholds disagree:** four places each define their own bands. The recommender uses 95–98, the zone labels treat over 98% as "too easy" (it should be ideal) and 85% as stretch (it should be 90%), the watch message adds a 40% tier, and Continue Watching uses 95.
- **Wording:** cards say "% understood" and "Average comprehension" for what is really vocabulary coverage.
- The scoring already uses the real transcript against your own word deck, not CEFR. That stays.

## Plan
1. **One central rule:** a single coverage module holding the 98 / 95 / 90 cut-offs, the labels and the 🟢🟡🟠🔴 badge. Every other place imports it.
2. **Recommendations:** rank by closeness to 98%. Fill with 95%+ first, add 90–94.9% only as "Challenging" and only if there's room, and drop under 90%. Rescore on each visit using your current deck, so new words are counted.
3. **Language filter everywhere:** the catalogue, Continue Watching, rails and searches show only videos in your active learning language.
4. **Continue Watching rebuilt:** built from your watch history (any video you started and haven't finished) in the current language, newest first. Shows the coverage badge when it's scored. The 95% cut-off is removed.
5. **Display:** use "🟢 96% vocabulary coverage" on cards, the watch screen and results. Change "understood" or "comprehension" to "vocabulary coverage" wherever it's word-based.

## Technical details
- New `src/lib/coverage.ts`: `COVERAGE = { IDEAL: 98, MIN: 95, STRETCH: 90 }`, `coverageTier(pct)`, `coverageBadge(pct)`, `rankScore(pct)`. `understanding.learningZone`, `videoRecommendation` (IDEAL_MIN/MAX, distanceFromIdeal), `videoComprehension.zoneMessage` and `ContinueWatchingRail` all delegate to it.
- `ContinueWatchingRail`: query `watch_history` with `language = learningLanguage` and `completion_pct < 90`. Join `video_comprehension` only for the badge.
- `Browse.tsx` / `DiscoverCatalog.tsx` films query: add `.eq("language", learningLanguage)`.
- `PersonalizedRails` ZONE_LABEL replaced by `coverageBadge`.
- AGENTS.md rule: "coverage.ts is the only source of coverage thresholds".
