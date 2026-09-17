# Frequency-graded learning + sentence structures

## What I checked first

Your worry about the six old languages conflicting with the new lists: I checked the database and there is **no conflict**. The new 20,000-word lists were written over the old rows by word, so nothing is duplicated — 0 duplicate words, 0 duplicate ranks, all seventeen languages sitting at 20,000 words with A1–C2 bands and meanings.

The only leftovers are **1,172 stray old words** in French, Portuguese and Russian that fell outside the new top 20,000. They are parked at ranks above 20,000, marked C2, and **not a single learner is using any of them**. They are harmless, but they are noise, so the plan removes them.

## 1. Clean up the old leftovers

Delete the 1,172 unused leftover words in French, Portuguese and Russian so every language is exactly the top 20,000 by frequency, nothing more.

## 2. Grade every saved word by frequency

Right now a learner's saved words carry no sense of how common they are, so a rare word competes with an everyday one for attention.

- Add a frequency rank and level band to each saved word, filled in from the master list by matching the word (and its dictionary form).
- Backfill every existing saved word in one pass.
- Words that aren't in the list (names, slang) get no rank and sort last.
- Review and exercise queues then order by frequency: most common unknown word first.
- The home screen can then honestly say things like "you know 820 of the 1,000 most common French words".

## 3. Common sentence structures

A new library of sentence patterns per language, so exercises teach structure, not just vocabulary.

Each pattern stores: the language, its level (A1–C2), a usage rank, the template with slots (e.g. *"Je voudrais ___ , s'il vous plaît"*), a plain-English explanation of what it's for, and a worked example with translation.

Seeding: I write ~60 core patterns per language covering the structures a learner meets first — stating, negating, asking, past/future, wanting, comparing, conditionals — graded A1 through C2. Starting set: French, Spanish, Italian, German, Portuguese, then the rest in a follow-up.

## 4. Exercise generation uses both

Today an exercise is generated from a saved word alone. After this change each exercise picks:

- the **most frequent word** the learner doesn't yet know (or is due), and
- a **sentence pattern** at or just below their level that hasn't been drilled recently,

then asks the AI to write a sentence that uses that word inside that pattern. The pattern used is recorded on the exercise, so patterns rotate and progress in difficulty alongside the words.

## Technical notes

- `core_vocabulary`: delete `rank > 20000` rows (fr/pt/ru, 1,172 rows, zero `user_vocabulary_state` references).
- `saved_words`: add `frequency_rank int`, `frequency_level text`; backfill via join on `core_vocabulary (language, word|lemma)`; index on `(user_id, language, frequency_rank)`.
- New `sentence_patterns` table: `language, cefr_level, usage_rank, template, slots jsonb, explanation, example, example_translation`; public read, admin write, with GRANTs.
- `linguascripts`: add `pattern_id uuid` referencing `sentence_patterns`.
- `generate-personalized-linguascript` edge function: accept a pattern and constrain the generated sentence to it.
- Queue ordering updated in `src/lib/linguascripts.ts` and `src/lib/vocab.ts`.

## What you don't need to do

Nothing to paste — no word lists, no decks. All seventeen languages are already backed.
