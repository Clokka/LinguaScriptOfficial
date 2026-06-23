
-- 1) Migrate legacy 'red' state to 'orange' (red is being retired; saved words are always at least "learning")
UPDATE public.saved_words SET state = 'orange' WHERE state = 'red';

-- 2) Seed-known-vocabulary RPC: inserts top-N high-frequency words from core_vocabulary
--    into saved_words as state='green' for the current user, based on a CEFR level.
CREATE OR REPLACE FUNCTION public.seed_known_vocabulary(_language text, _level text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

  n := CASE lower(coalesce(_level,''))
         WHEN 'beginner' THEN 0
         WHEN 'a1' THEN 200
         WHEN 'a2' THEN 500
         WHEN 'b1' THEN 1200
         WHEN 'b2' THEN 2000
         WHEN 'c1' THEN 2500
         WHEN 'c1+' THEN 2500
         ELSE 0
       END;

  IF n = 0 THEN RETURN 0; END IF;

  WITH top_words AS (
    SELECT word, translation
      FROM public.core_vocabulary
     WHERE language = _language
     ORDER BY rank ASC NULLS LAST
     LIMIT n
  ), ins AS (
    INSERT INTO public.saved_words (user_id, word, translation, language, state, state_changed_at)
    SELECT auth.uid(), tw.word, tw.translation, _language, 'green', now()
      FROM top_words tw
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_known_vocabulary(text, text) TO authenticated;
