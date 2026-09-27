# Sentence Lab: exact verb-form data + a better exercise order

## Goal
Sentence Lab should never mark a right answer wrong, or a wrong answer right, because of a conjugation or tense. It should also teach in a sensible order: recognise a word first, then use it.

## Part 1: Word-form dictionary (fixes irregular forms, works in every language)
- A new dictionary that maps every inflected form to its base word and its exact form. For example, "mantuvo" is recorded as tener, conjugated, 3rd person singular, past (preterite).
- Filled once per language from UniMorph, a free, expert-checked word-form dataset that covers all 17 of our languages, irregular forms included.
- Forms UniMorph doesn't have (slang, words with a pronoun attached like "ayudarme") are analysed by AI the first time a learner saves them, then stored for good.
- Every saved word is linked to its dictionary entry when saved. Existing saved words are filled in with a one-time pass.

## Part 2: Each gap says what it accepts
- Each sentence frame lists what its gap needs: kind of word, verb form, and where it matters, person and tense. Example: "¿Puedes ___?" needs a verb in the infinitive.
- The answer check compares the learner's word to that requirement, so hints are exact: "This needs the infinitive (ayudar), not the past form (intentaste)."
- The meaning check (AI, stored for good) still runs only after the form is right.
- The old ending-guessing rules are removed.

## Part 3: Exercise order (based on how people learn vocabulary)
Each word moves through these stages, one at a time:
1. **Recognise:** hear or see the word in the video line, then pick its meaning.
2. **Notice the frame:** see a model sentence with the frame highlighted, and its translation.
3. **Guided gap:** fill the frame from 3 of your saved words that are all already in the correct form. Only the meaning is tested.
4. **Form choice:** pick the correct form of the word (for example ayudar / ayudando / ayudó).
5. **Free production:** write your own sentence with the word. The AI gives feedback.

- A word moves up a stage after a correct answer and drops back one stage after two misses (fits your red → orange → green colours).
- A word is only put in a board if its form data is confirmed, so the learner never gets an impossible gap.
- Sessions mix old and new words: about 70% review, 30% new, at most 10 items.

## Technical details
- Table `word_forms(language, surface, lemma, pos, form, person, number, tense, mood, source)`, unique (language, surface), public read, service-role write, with GRANTs.
- Edge function `analyze-word-form`: looks up the word, falls back to the AI gateway (structured output), then saves the result.
- Script to import UniMorph TSVs for each language.
- Add `saved_words.word_form_id`.
- Add `slots[].accepts {pos, form, person?, tense?}` to `sentence_patterns`, backfilled for the existing 110 patterns.
- `sentenceLabCheck.ts`: remove `verbFormFamily`/clitics and compare against `accepts` instead.
- `sentenceLabBoard.ts`: build boards by stage, keeping only candidates that have form data.
- Store each word's stage on `linguascripts` (new `stage smallint`).
