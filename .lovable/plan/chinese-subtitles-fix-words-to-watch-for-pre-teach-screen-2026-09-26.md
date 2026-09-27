# Chinese subtitles fix + "Words to watch for" pre-teach screen

## Part 1 — Fix missing subtitles (Chinese intro video)

Audit: "Super Beginner Chinese – Comprehensible Input" (YouTube WjvTAyUc9ro) has **zero** stored subtitle lines in any language. The in-browser fetch and the backend fetch both fail for it (likely the Chinese track is labelled `zh-Hans`/`zh-CN`/`zh-TW`, not `zh`), so nothing ever gets saved.

Fix:
- Caption fetchers (browser + backend) try language variants: `zh` → `zh-Hans`, `zh-CN`, `zh-Hant`, `zh-TW`, then auto-generated tracks. Same variant logic for `pt-BR`, `es-419`, `en-US/GB`.
- Admin: add a "Fetch & store subtitles" button per film (and "Fetch missing for all intro videos"). It fetches the learning-language track, AI-translates the English side, and saves both so learners load instantly.
- Run it once now for the Chinese video and any other of the 17 intro films with no stored subtitles, then confirm lines appear.

## Part 2 — Pre-teach stage (replaces the loading screen)

Today the watch page shows an ad-style "Loading video…" card. Replace it with a **"Words to watch for"** card — the Present step of a PPP lesson.

What the learner sees:
- "Look out for these 8 words" (number = their daily word goal from onboarding, e.g. 8).
- Each item: word/phrase, translation, short example line from the video, speaker button, CEFR tag.
- "Start watching" button (auto-enabled once the video is ready). Words appear with a gold glow in the subtitles when they come up; saving them counts toward the video target ("3/8 saved").

How words are chosen (per video, computed once and stored):
1. Scan the full transcript; group words to their base form.
2. Grade each against our 20,000-word frequency/CEFR list (Vocab-Kitchen style).
3. Keep items **at or one level above** the learner's level; drop words they already know (green).
4. Priority order:
   - Collocations and short phrases — only if high-frequency, simple structure, clearly useful (e.g. "il y a", "avoir besoin de"). Matched against our sentence-pattern list.
   - High-frequency words that **recur in this video** (appear 2+ times).
   - Never rare/concrete low-value nouns (cucumber, helicopter): rank cap ~4,500 for A-level learners, scaled by level.
5. Top N by score = frequency × repeats × level fit, phrases boosted.

## Technical details
- New table `film_target_words` (film_id, language, cefr_level, item, is_phrase, lemma, translation, example, rank, occurrences, score); public read, admin/service write. Per-user filtering (known words, goal count) happens on read.
- New backend function `grade-film-vocab`: loads subtitles, tokenises (word segmentation for zh/ja/th), joins `core_vocabulary` by lemma, detects phrases via `sentence_patterns` + n-gram counts, uses AI only to validate/translate the shortlisted phrases. Triggered after subtitles are stored and from Admin.
- `Watch.tsx`: replace loading card with `PreTeachCard`; highlight target words in `SubtitleOverlay`; track "x/N saved" per video.
- Caption variant list added to `browserCaptionFetcher.ts` and `fetch-captions`.
- Admin panel: per-film "Fetch subtitles" + "Grade vocab" buttons and a status column.

## Order
1. Subtitle variants + admin fetch button, backfill Chinese video.
2. Table + grading function, backfill intro films.
3. Pre-teach card + subtitle highlights + target counter.
