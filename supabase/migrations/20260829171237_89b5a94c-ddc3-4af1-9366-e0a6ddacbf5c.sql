CREATE OR REPLACE FUNCTION public.cefr_cumulative_target(_level text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
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

REVOKE EXECUTE ON FUNCTION public.seed_known_vocabulary(text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.cefr_level_progress(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enforce_language_profile_limit() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_known_vocabulary(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cefr_level_progress(text) TO authenticated;