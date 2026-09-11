-- Lemmatization: a clicked word is often an inflected surface form (French
-- "manges" from "manger", German "weiß" from "wissen"), and teaching that
-- surface form as if it were the dictionary word is a real accuracy bug —
-- a learner memorizes "manges = eat" instead of "manger = to eat". These
-- columns store the dictionary form and its translation alongside the
-- surface form the app already keeps in `word`/`translation`, so a
-- flashcard can teach the correct lemma while still showing the real
-- in-context usage.
ALTER TABLE public.saved_words
  ADD COLUMN IF NOT EXISTS lemma text,
  ADD COLUMN IF NOT EXISTS lemma_translation text,
  ADD COLUMN IF NOT EXISTS pos text,
  ADD COLUMN IF NOT EXISTS is_inflected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS grammar_note text;
