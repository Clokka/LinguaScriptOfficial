-- A cache of extra example sentences per word, sourced from Tatoeba.
--
-- This is word-level, not user-level: any learner asking for "bonjour" in
-- French gets the same cached rows, so it's a plain public-read table rather
-- than a saved_words-style per-user one. The fetch-tatoeba-sentences edge
-- function writes to it with the service-role key (bypassing RLS); nothing
-- else needs to insert or update it.
CREATE TABLE IF NOT EXISTS public.word_example_sentences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL,
  language text NOT NULL,
  sentence text NOT NULL,
  translation text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'tatoeba',
  source_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.word_example_sentences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone signed in can read cached example sentences"
  ON public.word_example_sentences FOR SELECT TO authenticated USING (true);

-- One cached row per source sentence per word/language, and the lookup index
-- the edge function's "do we already have 3?" check runs on.
CREATE UNIQUE INDEX IF NOT EXISTS word_example_sentences_word_lang_source
  ON public.word_example_sentences (word, language, source, source_id);
