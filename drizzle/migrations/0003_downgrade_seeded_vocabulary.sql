CREATE OR REPLACE FUNCTION public.downgrade_seeded_vocabulary(_language text, _level text, _mode text DEFAULT 'fluency')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  target integer;
  removed integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF lower(coalesce(_mode,'fluency')) = 'cefr' THEN
    target := public.cefr_cumulative_target(
      CASE lower(coalesce(_level,''))
        WHEN 'a2' THEN 'a1' WHEN 'b1' THEN 'a2' WHEN 'b2' THEN 'b1'
        WHEN 'c1' THEN 'b2' WHEN 'c2' THEN 'c1' ELSE '' END);
  ELSE
    target := public.cefr_cumulative_target(_level);
  END IF;
  target := coalesce(target, 0);

  WITH keep AS (
    SELECT word FROM public.core_vocabulary
     WHERE language = _language
     ORDER BY rank ASC NULLS LAST
     LIMIT target
  ), del AS (
    DELETE FROM public.saved_words sw
     WHERE sw.user_id = auth.uid()
       AND sw.language = _language
       AND sw.state = 'green'
       AND sw.next_review >= DATE '2999-01-01'
       AND coalesce(sw.review_count, 0) = 0
       AND NOT EXISTS (SELECT 1 FROM keep k WHERE k.word = sw.word)
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM del;

  UPDATE public.language_profiles
     SET cefr_level = lower(_level),
         seeded_level = CASE WHEN target = 0 THEN NULL ELSE lower(_level) END,
         seeded_mode = lower(coalesce(_mode,'fluency'))
   WHERE user_id = auth.uid() AND language = _language;

  RETURN removed;
END;
$function$;

REVOKE ALL ON FUNCTION public.downgrade_seeded_vocabulary(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.downgrade_seeded_vocabulary(text, text, text) TO authenticated;