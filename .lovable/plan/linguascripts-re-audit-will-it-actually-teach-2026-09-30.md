# LinguaScripts re-audit: will it actually teach?

## Verdict
The shape is right (hear it → recognise → recall → use it, spaced over days). But in practice several mechanics let a learner "pass" without learning, and a few go against how memory works. Rating today: about 5/10 as a teaching tool. The fixes below target 8–9/10.

## Weaknesses found (by learning principle)

1. **All steps for one word happen back-to-back (massed practice).** Hear "pas" → pick meaning → fill gap with "pas" → recall "pas", all within ~20 seconds. Recall right after seeing the answer tests short-term memory, not learning. Research (Karpicke, Bjork "desirable difficulties") says spread and mix items.
2. **A word can go red → green in one session.** A clean recall seconds after being shown the word promotes it. Green should mean "remembered on a later day".
3. **Mistakes don't come back in the same session.** A wrong answer just moves on. Learners need to get it right once before leaving (relearning).
4. **Only the recall step affects scheduling.** Failing listen-and-choose or the gap is ignored.
5. **Too-easy choices.** Meaning step has only 3 options drawn from the other words in the session (with 2 words it's a coin toss). Gap choices come from session/sentence words, not same type and frequency, and are sorted alphabetically so position is guessable.
6. **Weak feedback when wrong.** It marks red but doesn't show the full sentence, its translation and the word's meaning together. Corrective feedback is where learning happens.
7. **Sentence quality.** Subtitle scraps with character names ("mademoiselle bertignac…") still get through. Fresh sentences are always pitched at B1, ignoring the learner's level.
8. **Word pairs taught apart.** "ne … pas", "il y a", "est-ce que" are split.
9. **No ladder feedback at the end.** No "3 more words to reach the top 850".

## Fixes

- **Interleaved session order:** Round 1 = listen & pick meaning for all words. Round 2 = fill the gap for all words (shuffled). Round 3 = recall from English only, with a new sentence where possible. Then one short sentence of your own. Every item takes a few minutes of gap before it's tested again.
- **Relearning loop:** anything missed is put back at the end of the current round until answered correctly (max 2 retries).
- **Promotion only across days:** red → orange on a clean session; orange → green only when the recall is clean *and* the word was last seen on an earlier day. (Keeps your rule: one correct review moves orange to green.)
- **Scheduling uses all steps:** clean on everything = next step up (1→3→7→21→60 days); any slip = hold; recall failed or revealed = tomorrow. Small random jitter so reviews don't all pile on the same day.
- **Better choices:** always 4 options, no duplicates. Meaning distractors come from common words of the same type in the learner's frequency band; gap distractors the same, matched to the sentence form where the form data exists. Truly random order.
- **Rich feedback card after every answer:** the full sentence with the word highlighted, English translation, meaning, a play button, and for wrong answers "you picked X, which means Y".
- **Sentence filter:** reject sentences with mid-sentence capitalised names, fewer than 4 or more than 12 words, or missing the word; generate a clean one instead, at the learner's own level and interests.
- **Word pairs:** a small list of common pairs per language (fr/es/it/de/pt); these are shown, gapped and checked as one unit.
- **End screen:** words reviewed, accuracy, when they come back, and "X more words to reach the top N".

## Technical details
- `LinguaScriptSession.tsx`: rebuild `generateStages` into rounds; add retry queue; collect per-word outcome across steps and write `stage`/`scheduled_for`/`saved_words.state` once per word at round 3; promotion gate uses `saved_words.last_reviewed_at`/`state_changed_at` date < today; await writes before completion.
- `RecogniseStep.tsx`: 4 options, distractors from `core_vocabulary` (same `pos`, rank ±200) via a helper in `src/lib/linguascripts.ts`; feedback card component shared by all steps.
- `buildExerciseOptions`: Fisher–Yates shuffle; distractors from same helper; forms via `word_forms` (never suffix guesses).
- Sentence quality check helper + `generate-linguascript` prompt: pass learner CEFR (from `language_profiles`) and interests; require 5–10 words, no names, include exact word.
- New `src/lib/multiwordUnits.ts` for pairs; gap/recall treat them as one token span.
- Completion screen reads `frequency_coverage` for distance to next milestone.
- Verify with a Playwright run through a full session on the preview.
