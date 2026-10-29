-- Fast word translations: one shared dictionary, read before any translator.
--
-- • Seeded with the 10,000 most common words per language (seed-dictionary
--   function, frequency lists from github.com/hermitdave/FrequencyWords,
--   CC-BY-SA 4.0), translated once with Google Translate.
-- • Every word translate-word looks up is saved here too, so the same word
--   tapped by 1,000 learners is translated once.
-- Readable by everyone; only the server (service role) writes.

CREATE TABLE IF NOT EXISTS public.word_dictionary (
  language      text NOT NULL,            -- the word's language, e.g. 'fr'
  word          text NOT NULL,            -- lower-case, as normalizeToken() keys it
  target        text NOT NULL,            -- the meaning's language, e.g. 'en'
  translation   text NOT NULL,
  lemma         text,
  pos           text,
  ipa           text,
  pronunciation text,
  rank          integer,                  -- frequency rank (1 = most common), null for looked-up words
  source        text NOT NULL DEFAULT 'google',  -- 'google' | 'ai' | 'core'
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (language, word, target)
);

CREATE INDEX IF NOT EXISTS word_dictionary_rank_idx
  ON public.word_dictionary (language, target, rank);

ALTER TABLE public.word_dictionary ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Dictionary is readable by everyone" ON public.word_dictionary;
CREATE POLICY "Dictionary is readable by everyone"
  ON public.word_dictionary FOR SELECT
  TO anon, authenticated
  USING (true);

GRANT SELECT ON public.word_dictionary TO anon, authenticated;
GRANT ALL ON public.word_dictionary TO service_role;

-- Start from the hand-made English meanings we already have.
INSERT INTO public.word_dictionary (language, word, target, translation, lemma, pos, rank, source)
SELECT lower(cv.language), lower(cv.word), 'en', cv.translation, cv.lemma, cv.pos, cv.rank, 'core'
  FROM public.core_vocabulary cv
 WHERE cv.translation IS NOT NULL AND cv.translation <> '' AND cv.word !~ '\s'
ON CONFLICT (language, word, target) DO NOTHING;
