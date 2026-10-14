-- "Total beginner" becomes a real, protected setting.
--
-- It used to be stored as cefr_level 'a1' with seeded_level left NULL as the
-- only marker. The app re-seeded A1 vocabulary on every load (and during
-- onboarding), which set seeded_level = 'a1', pre-marked ~600 words as known
-- and showed a brand-new learner as A1.

ALTER TABLE public.language_profiles
  ADD COLUMN IF NOT EXISTS total_beginner boolean NOT NULL DEFAULT false;

-- Existing beginners: A1 with nothing seeded.
UPDATE public.language_profiles
   SET total_beginner = true
 WHERE cefr_level = 'a1' AND seeded_level IS NULL AND NOT total_beginner;

-- seed_known_vocabulary refuses to seed a total beginner (same function as
-- 20260916144328, plus the guard).
CREATE OR REPLACE FUNCTION public.seed_known_vocabulary(_language text, _level text, _mode text DEFAULT 'fluency'::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target integer;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

  -- "Total beginner": nothing is pre-marked as known, whoever calls this.
  IF EXISTS (
    SELECT 1 FROM public.language_profiles
     WHERE user_id = auth.uid() AND language = _language AND total_beginner
  ) THEN
    RETURN 0;
  END IF;

  IF lower(coalesce(_mode,'fluency')) = 'cefr' THEN
    target := public.cefr_cumulative_target(
      CASE lower(coalesce(_level,''))
        WHEN 'a1' THEN ''
        WHEN 'a2' THEN 'a1'
        WHEN 'b1' THEN 'a2'
        WHEN 'b2' THEN 'b1'
        WHEN 'c1' THEN 'b2'
        WHEN 'c1+' THEN 'c1'
        WHEN 'c2' THEN 'c1'
        ELSE ''
      END);
  ELSE
    target := public.cefr_cumulative_target(_level);
  END IF;

  IF target IS NULL OR target = 0 THEN RETURN 0; END IF;

  WITH top_words AS (
    SELECT word, translation
      FROM public.core_vocabulary
     WHERE language = _language
     ORDER BY rank ASC NULLS LAST
     LIMIT target
  ), ins AS (
    INSERT INTO public.saved_words
      (user_id, word, translation, language, state, state_changed_at, green_revealed_at, next_review)
    -- Parked far in the future: these are "already known" from the level the
    -- learner declared, never study work. A past date made every one of them
    -- look due and produced absurd review-reminder counts.
    SELECT auth.uid(), tw.word, tw.translation, _language, 'green', now(), now(), DATE '2999-01-01'
      FROM top_words tw
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  UPDATE public.language_profiles
     SET seeded_level = lower(coalesce(_level,'')),
         seeded_mode = lower(coalesce(_mode,'fluency'))
   WHERE user_id = auth.uid() AND language = _language;

  RETURN inserted;
END;
$function$;

NOTIFY pgrst, 'reload schema';
