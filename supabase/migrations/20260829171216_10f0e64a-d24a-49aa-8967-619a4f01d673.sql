-- 1. Chameleon as default pet
ALTER TABLE public.profiles ALTER COLUMN active_pet SET DEFAULT 'chameleon';

UPDATE public.profiles SET active_pet = 'chameleon' WHERE active_pet IS NULL;

INSERT INTO public.pet_collection (user_id, pet_id)
SELECT p.user_id, 'chameleon'
  FROM public.profiles p
 WHERE NOT EXISTS (
   SELECT 1 FROM public.pet_collection pc
    WHERE pc.user_id = p.user_id AND pc.pet_id = 'chameleon'
 );

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, active_pet)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email), 'chameleon');

  INSERT INTO public.pet_collection (user_id, pet_id)
  VALUES (NEW.id, 'chameleon')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Per-language learner profiles (max 5 per user)
CREATE TABLE public.language_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL,
  mode text NOT NULL DEFAULT 'fluency',
  cefr_level text NOT NULL DEFAULT 'a1',
  seeded_level text,
  seeded_mode text,
  understanding_score numeric NOT NULL DEFAULT 0,
  words_known integer NOT NULL DEFAULT 0,
  daily_word_goal integer NOT NULL DEFAULT 5,
  daily_video_goal integer NOT NULL DEFAULT 1,
  interests text[] NOT NULL DEFAULT '{}',
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT language_profiles_mode_check CHECK (mode IN ('fluency','cefr')),
  CONSTRAINT language_profiles_unique UNIQUE (user_id, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.language_profiles TO authenticated;
GRANT ALL ON public.language_profiles TO service_role;

ALTER TABLE public.language_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own language profiles"
ON public.language_profiles FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_language_profiles_updated_at
BEFORE UPDATE ON public.language_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_language_profile_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.language_profiles WHERE user_id = NEW.user_id;
  IF n >= 5 THEN
    RAISE EXCEPTION 'language_limit_reached';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER language_profiles_limit
BEFORE INSERT ON public.language_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_language_profile_limit();

-- backfill from existing profiles
INSERT INTO public.language_profiles (user_id, language, cefr_level, daily_word_goal, daily_video_goal, interests)
SELECT p.user_id,
       p.learning_language,
       lower(COALESCE(NULLIF(p.cef_level, ''), 'a1')),
       COALESCE(p.daily_word_goal, 5),
       COALESCE(p.daily_video_goal, 1),
       COALESCE(p.interests, '{}')
  FROM public.profiles p
 WHERE p.learning_language IS NOT NULL AND length(trim(p.learning_language)) > 0
ON CONFLICT (user_id, language) DO NOTHING;

-- 3. CEFR tagging on core vocabulary
ALTER TABLE public.core_vocabulary ADD COLUMN IF NOT EXISTS cefr_level text;

UPDATE public.core_vocabulary
   SET cefr_level = CASE
     WHEN rank <= 600 THEN 'a1'
     WHEN rank <= 1200 THEN 'a2'
     WHEN rank <= 2500 THEN 'b1'
     WHEN rank <= 4500 THEN 'b2'
     WHEN rank <= 9000 THEN 'c1'
     ELSE 'c2'
   END
 WHERE cefr_level IS NULL;

CREATE INDEX IF NOT EXISTS core_vocabulary_language_cefr_idx
  ON public.core_vocabulary (language, cefr_level);

-- 4. CEFR absolute-count seeding, mode aware
CREATE OR REPLACE FUNCTION public.cefr_cumulative_target(_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT CASE lower(coalesce(_level,''))
    WHEN 'a1' THEN 600
    WHEN 'a2' THEN 1200
    WHEN 'b1' THEN 2500
    WHEN 'b2' THEN 4500
    WHEN 'c1' THEN 9000
    WHEN 'c1+' THEN 12000
    WHEN 'c2' THEN 16000
    ELSE 0
  END;
$function$;

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

  -- In the CEFR exam track, everything BELOW the chosen level is pre-known.
  -- In the fluency track, the chosen level's full cumulative target is pre-known.
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
    SELECT auth.uid(), tw.word, tw.translation, _language, 'green', now(), now()
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

-- 5. Level progress / advancement check for the CEFR track
CREATE OR REPLACE FUNCTION public.cefr_level_progress(_language text)
RETURNS TABLE(level text, total_words integer, known_words integer, can_advance boolean, next_level text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  lvl text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT lower(lp.cefr_level) INTO lvl
    FROM public.language_profiles lp
   WHERE lp.user_id = auth.uid() AND lp.language = _language;

  IF lvl IS NULL THEN lvl := 'a1'; END IF;

  RETURN QUERY
  WITH lw AS (
    SELECT cv.word
      FROM public.core_vocabulary cv
     WHERE cv.language = _language AND lower(cv.cefr_level) = lvl
  ), known AS (
    SELECT count(*)::int AS c
      FROM lw
      JOIN public.saved_words sw
        ON lower(sw.word) = lower(lw.word)
       AND sw.user_id = auth.uid()
       AND sw.language = _language
       AND sw.state = 'green'
  )
  SELECT lvl,
         (SELECT count(*)::int FROM lw),
         (SELECT c FROM known),
         (SELECT count(*) FROM lw) > 0 AND (SELECT c FROM known) >= (SELECT count(*) FROM lw),
         CASE lvl WHEN 'a1' THEN 'a2' WHEN 'a2' THEN 'b1' WHEN 'b1' THEN 'b2'
                  WHEN 'b2' THEN 'c1' WHEN 'c1' THEN 'c2' ELSE NULL END;
END;
$function$;