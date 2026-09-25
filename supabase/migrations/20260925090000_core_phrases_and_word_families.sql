-- Chunks, phrase-frames and word families: the data behind "frequency first,
-- tiny grammar words taught inside chunks".
--
-- 1. Word families on core_vocabulary.
--    "manges", "mangeons" and "mangé" are separate rows ranked separately, so
--    no single form looks as common as the verb really is. `family` groups
--    them under one dictionary form ("manger") with the family's combined
--    frequency and rank. A new column rather than reusing `lemma`: `lemma` is
--    UNIQUE per language and apply_cefr_overrides() upserts on it, so it can't
--    hold a value shared by several rows.
ALTER TABLE public.core_vocabulary
  ADD COLUMN IF NOT EXISTS family text,
  ADD COLUMN IF NOT EXISTS family_rank integer,
  ADD COLUMN IF NOT EXISTS family_freq bigint;

CREATE INDEX IF NOT EXISTS idx_core_vocab_family
  ON public.core_vocabulary (language, family);

-- 2. core_phrases: teachable multi-word items.
--    kind = 'chunk'  a fixed phrase / collocation ("il y a", "tout à fait")
--    kind = 'frame'  a phrase-frame with one open slot ("je suis *"), the
--                    board shapes for the Sentence Lab
--    `match_form` is the tokenised form subtitles are matched against
--    (see src/lib/phraseFrames.ts tokenize), `lemma_key` the same with every
--    word in its dictionary form, so "j'avais besoin de" still matches
--    "j'ai besoin de". Rows load from reviewed CSVs via
--    scripts/seed-core-phrases.ts; `reviewed` = a human said yes.
CREATE TABLE IF NOT EXISTS public.core_phrases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('chunk', 'frame')),
  phrase text NOT NULL,
  match_form text NOT NULL,
  lemma_key text,
  n smallint NOT NULL,
  rank integer,
  frequency bigint,
  mi real,
  range_pct real,
  top_fillers text[],
  translation text,
  cefr_level text,
  source text NOT NULL,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language, kind, match_form)
);

CREATE INDEX IF NOT EXISTS idx_core_phrases_lang_kind_rank
  ON public.core_phrases (language, kind, rank);
CREATE INDEX IF NOT EXISTS idx_core_phrases_lemma_key
  ON public.core_phrases (language, lemma_key);

GRANT SELECT ON public.core_phrases TO anon, authenticated;
GRANT ALL ON public.core_phrases TO service_role;

ALTER TABLE public.core_phrases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Core phrases are readable by everyone" ON public.core_phrases;
CREATE POLICY "Core phrases are readable by everyone"
  ON public.core_phrases FOR SELECT
  USING (true);

DROP TRIGGER IF EXISTS trg_core_phrases_updated ON public.core_phrases;
CREATE TRIGGER trg_core_phrases_updated
BEFORE UPDATE ON public.core_phrases
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
