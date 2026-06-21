CREATE OR REPLACE FUNCTION public.seed_known_vocabulary(_language text, _level text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pct numeric;
  total integer;
  n integer;
  inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

  pct := CASE lower(coalesce(_level,''))
           WHEN 'a1' THEN 0.10
           WHEN 'a2' THEN 0.25
           WHEN 'b1' THEN 0.50
           WHEN 'b2' THEN 0.75
           WHEN 'c1' THEN 0.90
           WHEN 'c1+' THEN 0.94
           WHEN 'c2' THEN 0.98
           ELSE 0
         END;

  IF pct = 0 THEN RETURN 0; END IF;

  SELECT count(*) INTO total FROM public.core_vocabulary WHERE language = _language;
  IF total = 0 THEN RETURN 0; END IF;

  n := GREATEST(1, floor(total * pct)::int);

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
$function$;