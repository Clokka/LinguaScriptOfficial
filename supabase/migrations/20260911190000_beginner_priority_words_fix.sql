-- Fast Track's red-queue logic assumed everyone arriving at a CEFR level
-- already knows that level's vocabulary (pre-marked green by
-- seed_known_vocabulary), so it queued the NEXT tier up as red. That's
-- right for someone who tested in with real prior knowledge, but wrong for
-- a true beginner: onboarding now supports "I'm a total beginner," which
-- deliberately skips seed_known_vocabulary (nothing is pre-marked known —
-- see addLanguageProfile's totalBeginner path). For that learner, queuing
-- A2 first would skip the actual highest-frequency words entirely — the
-- opposite of what "start from the most common words" means.
--
-- Signal: seeded_level is NULL exactly when seed_known_vocabulary was never
-- called for this profile (no existing column needed). When it's NULL, the
-- priority tier is the learner's own current level, not the tier above it.
CREATE OR REPLACE FUNCTION public.seed_priority_words(_language text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lvl text;
  learner_mode text;
  seeded_lvl text;
  target_lvl text;
  batch_size integer;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

  SELECT lower(coalesce(lp.cefr_level, 'a1')),
         lower(coalesce(lp.mode, 'fluency')),
         coalesce(lp.daily_word_goal, 5),
         lp.seeded_level
    INTO lvl, learner_mode, batch_size, seeded_lvl
    FROM public.language_profiles lp
   WHERE lp.user_id = auth.uid() AND lp.language = _language;

  IF lvl IS NULL THEN lvl := 'a1'; END IF;
  IF batch_size IS NULL OR batch_size <= 0 THEN batch_size := 5; END IF;

  IF seeded_lvl IS NULL THEN
    -- Nothing pre-marked known yet — true beginner. Their own level IS the
    -- priority tier, in either mode.
    target_lvl := lvl;
  ELSIF learner_mode = 'cefr' THEN
    target_lvl := lvl;
  ELSE
    target_lvl := CASE lvl
      WHEN 'a1' THEN 'a2' WHEN 'a2' THEN 'b1' WHEN 'b1' THEN 'b2'
      WHEN 'b2' THEN 'c1' WHEN 'c1' THEN 'c2' ELSE NULL
    END;
  END IF;

  IF target_lvl IS NULL THEN RETURN 0; END IF;

  WITH candidates AS (
    SELECT cv.word, cv.translation
      FROM public.core_vocabulary cv
     WHERE cv.language = _language
       AND lower(cv.cefr_level) = target_lvl
       AND NOT EXISTS (
         SELECT 1 FROM public.saved_words sw
          WHERE sw.user_id = auth.uid()
            AND sw.language = _language
            AND lower(sw.word) = lower(cv.word)
       )
     ORDER BY cv.rank ASC NULLS LAST
     LIMIT batch_size
  ), ins AS (
    INSERT INTO public.saved_words (user_id, word, translation, language, state)
    SELECT auth.uid(), c.word, coalesce(nullif(c.translation, ''), ''), _language, 'red'
      FROM candidates c
    ON CONFLICT (user_id, word, language) DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END;
$function$;
