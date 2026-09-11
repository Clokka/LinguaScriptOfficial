-- Fluency Fast Track: which words should show up red first.
--
-- The existing seed_known_vocabulary() already seeds everything at-or-below
-- the learner's chosen level as green. What's missing is the mirror image:
-- proactively queuing the NEXT tier's words as red, in small batches, ranked
-- by frequency within that tier — so a Fast Track learner always has "the
-- next most important words" queued instead of whatever they happened to
-- click in a video.
--
-- Mode-aware, matching seed_known_vocabulary's own branch:
--   'cefr' mode    -> the learner's CURRENT level is what they're actively
--                     learning (everything below it is already pre-known),
--                     so the priority tier IS their current level.
--   'fluency' mode -> the current level (and everything below) is already
--                     seeded green, so the priority tier is the NEXT level up.
--
-- Batch size reuses language_profiles.daily_word_goal rather than a fixed
-- number like 1000 — dumping an entire tier's cumulative target (up to
-- 16,000 words for C2) into one learner's red deck at once would swamp
-- every other view that reads saved_words (Flashcards, subtitle colouring,
-- Vocabulary). Call this once per "top up my queue" moment (e.g. when the
-- Fast Track red pool for the target tier drops below the batch size) —
-- it's idempotent, only ever adding words the learner doesn't already have.
CREATE OR REPLACE FUNCTION public.seed_priority_words(_language text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lvl text;
  learner_mode text;
  target_lvl text;
  batch_size integer;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

  SELECT lower(coalesce(lp.cefr_level, 'a1')),
         lower(coalesce(lp.mode, 'fluency')),
         coalesce(lp.daily_word_goal, 5)
    INTO lvl, learner_mode, batch_size
    FROM public.language_profiles lp
   WHERE lp.user_id = auth.uid() AND lp.language = _language;

  IF lvl IS NULL THEN lvl := 'a1'; END IF;
  IF batch_size IS NULL OR batch_size <= 0 THEN batch_size := 5; END IF;

  IF learner_mode = 'cefr' THEN
    target_lvl := lvl;
  ELSE
    target_lvl := CASE lvl
      WHEN 'a1' THEN 'a2' WHEN 'a2' THEN 'b1' WHEN 'b1' THEN 'b2'
      WHEN 'b2' THEN 'c1' WHEN 'c1' THEN 'c2' ELSE NULL
    END;
  END IF;

  -- Already at the top of the ladder (fluency mode, c2) — nothing above it.
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

-- Frequency-list seeding (see scripts/seed-core-vocabulary.ts) won't always
-- have a translation on first import — translating tens of thousands of
-- words upfront is a real cost worth doing lazily instead. Relax the
-- constraint and make the existing seeder null-safe to match.
ALTER TABLE public.core_vocabulary ALTER COLUMN translation DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.seed_known_vocabulary(_language text, _level text, _mode text DEFAULT 'fluency')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target integer;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

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
      (user_id, word, translation, language, state, state_changed_at, green_revealed_at)
    SELECT auth.uid(), tw.word, coalesce(nullif(tw.translation, ''), ''), _language, 'green', now(), now()
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
