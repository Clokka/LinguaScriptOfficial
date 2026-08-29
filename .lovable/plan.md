# Multi-language profiles, accurate CEFR seeding, chameleon default

## 1. Accurate CEFR vocabulary seeding

Today `seed_known_vocabulary` marks a *percentage* of a 3,000-word list green. That is inaccurate: it caps every learner at 3k and treats C2 as 98% of 3k.

Change to absolute word-count targets, matching real CEFR sizes:

| Level | Words pre-marked green |
| --- | --- |
| A1 | 600 |
| A2 | 1,200 |
| B1 | 2,500 |
| B2 | 4,500 |
| C1 | 9,000 |
| C2 | 16,000 |

- Rewrite the seeding routine to take the top N words by frequency rank for the chosen language, where N is the table above, capped at whatever the language's list actually holds.
- Expand `core_vocabulary` frequency lists so higher levels are meaningful. Current coverage: pt 4,986 / de 3,000 / es 3,000 / it 3,000 / ru 3,000 / fr 2,889. Import open frequency lists (OpenSubtitles / hermitdave `FrequencyWords`, CC-BY-SA) to reach 20k per language for fr, es, de, it, pt, ru, plus new lists for zh, ja, hi, th, en.
- Seeding becomes per-language (see §2), so switching languages seeds that language's list only.
- Store the level that produced the seed so re-levelling top-ups instead of duplicating.

## 2. A separate learner profile per language (up to 5)

Right now one profile row holds a single `learning_language`, one comprehension score, one streak. Split the per-language state out.

- New `language_profiles` table: one row per user × language, holding CEFR level, seeded level, comprehension/understanding score, words-known counters, daily goals, interests, and last-active timestamp.
- Cap at 5 active languages per user. No upgrade prompts anywhere in this flow — all 5 slots are free.
- `profiles.learning_language` stays as "currently active language" pointer; everything else reads from the active `language_profiles` row.
- Scope existing per-language data properly: `saved_words`, `video_comprehension`, `watch_sessions`, `linguascripts` already carry a language column — all reads get filtered by the active language so comprehension, vocabulary stats and progress reset cleanly per language.
- Settings gains a **My languages** section: add a language (pick level → seed vocabulary), switch active language, remove a language (with confirmation, keeps data).
- Remove the free-plan language gating UI (`LanguageSelector` switch/upgrade dialogs and the "Free · 1 language" label).

## 3. Thai support

Add Thai (th) to the language list for both native and learning selections, with flag and TTS/voice mapping, plus a Thai frequency list in `core_vocabulary`. Thai has no spaces between words, so tokenisation for subtitle colouring needs a segmenter (Intl.Segmenter with `granularity: "word"`, which Chrome/Safari support) rather than whitespace splitting.

## 4. Chameleon as the default pet

- Every account starts with the chameleon in its collection and set as `active_pet` — via a signup trigger for new users and a one-off backfill for existing users with no active pet.
- Pet UI shows the chameleon by default instead of an empty state; it keeps the red/orange/green colour behaviour already in `chameleonColors`.

## 5. Fixing LinguaScripts accuracy

The current exercise checker marks correct answers wrong. Root causes to fix rather than swapping the whole system out:

- **Normalise before comparing**: case, accents/diacritics, curly vs straight apostrophes, hyphens, trailing punctuation, and multiple spaces.
- **Accept variants**: elisions (`j'ai`/`jai`), contracted forms, and any of the listed gap options that are genuinely valid in the sentence.
- **Fuzzy tolerance for typing exercises**: allow a small Levenshtein distance (1 edit for words ≥5 chars) and show a "close — here's the spelling" state instead of a hard fail.
- **Speaking exercises**: compare on phonetic similarity, not exact transcript match; Web Speech results are noisy.
- **AI grading as the fallback, not the first check**: only call the model when the deterministic check fails, and constrain it to a strict verdict schema so it cannot invent corrections.
- **Generation quality**: validate every generated exercise before it is shown — the target word must actually appear in the sentence, the gap position must line up, and distractors must be distinct from the answer. Reject and regenerate otherwise.

Libraries worth pulling in rather than hand-rolling: a diacritics-folding helper, a Levenshtein implementation, and `Intl.Segmenter` for tokenising. No full replacement repository is needed — the failure is in the comparison layer, not the exercise concept.

## 6. High-frequency unknown words (ideas only — not built now)

Recorded for later, no implementation in this pass:

- Rank every unknown word by frequency rank × appearance count in the learner's own watch history, and surface the top ones as "high-value catches".
- Show a subtle marker in subtitles (a small badge or brighter weight) on words in the top frequency band that the learner hasn't saved.
- Award an XP multiplier when a high-value word is saved and later promoted to green, so the boost rewards learning it, not just clicking it.
- A weekly "power words" set on the home screen: the 5 highest-impact unknown words, each with the estimated comprehension gain from learning it.

## Order of work

1. Chameleon default pet (smallest, highest priority).
2. Thai language support.
3. `language_profiles` table + settings UI + per-language scoping, remove upgrade gating.
4. CEFR absolute-count seeding + expanded frequency lists.
5. LinguaScripts accuracy fixes.
