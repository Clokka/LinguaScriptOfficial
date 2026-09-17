
-- 1. Clean up legacy leftovers (unused, outside top 20k)
DELETE FROM public.core_vocabulary WHERE language IN ('fr','pt','ru') AND rank > 20000;

-- 2. Frequency data on saved words
ALTER TABLE public.saved_words
  ADD COLUMN IF NOT EXISTS frequency_rank integer,
  ADD COLUMN IF NOT EXISTS frequency_level text;

UPDATE public.saved_words sw
   SET frequency_rank = cv.rank,
       frequency_level = cv.cefr_level
  FROM public.core_vocabulary cv
 WHERE cv.language = sw.language
   AND lower(cv.word) = lower(sw.word)
   AND sw.frequency_rank IS NULL;

UPDATE public.saved_words sw
   SET frequency_rank = cv.rank,
       frequency_level = cv.cefr_level
  FROM public.core_vocabulary cv
 WHERE cv.language = sw.language
   AND sw.lemma IS NOT NULL
   AND lower(cv.lemma) = lower(sw.lemma)
   AND sw.frequency_rank IS NULL;

CREATE INDEX IF NOT EXISTS saved_words_freq_idx
  ON public.saved_words (user_id, language, frequency_rank);

-- 3. Sentence patterns library
CREATE TABLE IF NOT EXISTS public.sentence_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL,
  cefr_level text NOT NULL,
  usage_rank integer NOT NULL,
  template text NOT NULL,
  slots jsonb NOT NULL DEFAULT '[]'::jsonb,
  explanation text NOT NULL,
  example text NOT NULL,
  example_translation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language, template)
);

GRANT SELECT ON public.sentence_patterns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sentence_patterns TO authenticated;
GRANT ALL ON public.sentence_patterns TO service_role;

ALTER TABLE public.sentence_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sentence patterns are readable by everyone"
  ON public.sentence_patterns FOR SELECT USING (true);
CREATE POLICY "Admins manage sentence patterns"
  ON public.sentence_patterns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_sentence_patterns_updated_at
  BEFORE UPDATE ON public.sentence_patterns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS sentence_patterns_lang_level_idx
  ON public.sentence_patterns (language, cefr_level, usage_rank);

-- 4. Record the pattern an exercise used
ALTER TABLE public.linguascripts
  ADD COLUMN IF NOT EXISTS pattern_id uuid REFERENCES public.sentence_patterns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS linguascripts_pattern_idx
  ON public.linguascripts (user_id, language, pattern_id, created_at DESC);

-- 5. Frequency coverage report
CREATE OR REPLACE FUNCTION public.frequency_coverage(_language text)
RETURNS TABLE(band integer, known_words integer, total_words integer, pct numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH bands(band) AS (
    VALUES (50),(100),(250),(500),(1000),(2000),(5000),(10000),(20000)
  ), known AS (
    SELECT sw.frequency_rank
      FROM public.saved_words sw
     WHERE sw.user_id = auth.uid()
       AND sw.language = _language
       AND sw.state = 'green'
       AND sw.frequency_rank IS NOT NULL
  ), totals AS (
    SELECT b.band,
           (SELECT count(*) FROM public.core_vocabulary cv
             WHERE cv.language = _language AND cv.rank <= b.band)::int AS total
      FROM bands b
  )
  SELECT t.band,
         (SELECT count(*) FROM known k WHERE k.frequency_rank <= t.band)::int,
         t.total,
         CASE WHEN t.total = 0 THEN 0
              ELSE round(100.0 * (SELECT count(*) FROM known k WHERE k.frequency_rank <= t.band) / t.total, 1)
         END
    FROM totals t
   ORDER BY t.band;
$$;
