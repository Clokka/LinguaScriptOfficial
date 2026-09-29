# The "hooked in 3 seconds" feed — audit, plan, first changes

## Audit: why you don't see anime first

1. **Anime is never the first thing you see.** The top row, "Recommended for you", mixes your first 3 interests into one search ("anime OR football OR cooking"). YouTube handles that poorly, so the most generic results win. Your anime row only comes after it, further down.
2. **Every row stays hidden until checking finishes.** Before showing anything, the app downloads each video's subtitles and scores them against your words. That takes several seconds. Meanwhile you only see a loading line, which is the opposite of an instant hook.
3. **The scoring throws away most anime.** Only videos in the 95–98% "understood" band are kept. Most anime clips have auto-made subtitles or none at all, so they fail the check. If even one clip passes, the row shows just that one. The fallback to all results only kicks in when zero pass.
4. **The anime search is weak.** "French anime dubbed" brings back long episodes, compilations and English channels. The language check or the 20-minute cap then removes many of them.
5. **Nothing learns while you scroll.** The feed only learns when you tap a video. Skips, watch time, finishing a video and saving words are all ignored.
6. **Discover and the home page are the same page** (both use the same screen), so fixing it once fixes both.

## Principles (how TikTok and YouTube hook people, used for learning)

- **Instant reward:** show something good within 1 second, then improve it quietly in the background.
- **Your favourite comes first:** the interest you picked (and watch most) goes in the top slot, above everything else.
- **Short and snackable:** use 1–5 minute clips first and longer videos later, with a clear "2 min" tag.
- **Surprise now and then:** about 1 in 5 cards is a wildcard from a related topic, which keeps the feed from feeling stale.
- **Progress you can feel:** every card shows "You'll understand ~85%" and "3 new words", so each video is a small, winnable challenge.
- **Keep going after the end:** when a video ends, "Up next" starts in 5 seconds with a similar video, slightly harder (this ties into the planned difficulty loop).
- **Learn from everything:** taps, skips, watch time, rewatches and saved words all shape the next picks.

Healthy limits stay in: the daily goal still ends with a "goal done" moment, and there's no endless autoplay past the goal without a choice.

## First changes (this round)

1. **Anime first.** Your top-ranked interest gets its own first row, "Anime in French". The mixed "Recommended" row moves below it and pulls from each interest separately instead of one OR search.
2. **Show instantly, score later.** Rows appear straight away from saved results. The understanding % then fills in on each card as scoring finishes. No more waiting on a blank screen.
3. **Softer scoring.** Videos are sorted by closeness to the ideal band, not thrown away. Videos that can't be scored stay in the row with a "?" badge.
4. **Better interest searches.** Each interest gets 2–3 search phrases in the language being learnt (for example "anime en français VF", "anime VF extrait"), with short clips preferred.
5. **Short clips first.** In the top rows, clips under 6 minutes rank higher, and each card shows its length.
6. **Learn from behaviour.** Record opening a video, watching more than 50%, finishing it and saving words from it. Each interest's weight comes from these, and rows reorder next visit.
7. **"Up next" after a video.** At the end of a video, a card offers the next best clip from the same interest, with a 5-second countdown to start it.

## Later rounds (the world-class algorithm)

- Score each video per learner: a mix of interest match, predicted understanding (target 90–98%), new high-frequency words in the video, novelty, and freshness.
- Pick with a controlled mix: mostly best-known picks, some new ones, so it keeps finding new favourites.
- A vertical short-clip feed ("Snacks") of 30–90s moments with dual subtitles, swipe to the next.
- Tie in the progressive-difficulty loop: understanding up 15% unlocks the next harder video in the same interest.
- Build our own library of pre-scored anime and interest clips, so we rely less on YouTube's daily search allowance.

## Technical details

- `PersonalizedRails.tsx`: render rows from `cachedSearch` immediately. Run `rankByComprehension` asynchronously and merge `comprehensionPct` per item (sort, never filter). Replace the OR blend with a round-robin of the per-interest results. The top interest row renders first.
- `interests.ts`: `queries: Record<lang, string[]>` with an English fallback. Anime gets `VF`/`doblado`/`sub español`-style variants.
- A new `recordFeedEvent(kind, interest_id, video_id)` feeds `record_interest_pick` with weights (open 1, >50% 2, complete 3, saved word 2). Hooked into `Watch.tsx` progress.
- `Watch.tsx`: an end-of-video "Up next" overlay using the cached rail for the source interest (passed via query param).
- Respect the 20-minute cap, the language purity filter and the YouTube quota (the cache key includes the query variant, 24h TTL).
