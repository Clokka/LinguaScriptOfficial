CREATE OR REPLACE FUNCTION public.user_progress_stats(_language text DEFAULT NULL)
RETURNS TABLE(avg_comprehension numeric, highest_comprehension numeric, avg_gain_per_watch numeric, videos_mastered integer, videos_in_progress integer, total_minutes integer, vocab_learned integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  uid UUID := auth.uid();
  lang TEXT := nullif(lower(trim(coalesce(_language,''))), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT
    COALESCE(ROUND(AVG(vc.latest_score)::numeric, 1), 0)::numeric,
    COALESCE(MAX(vc.latest_score), 0)::numeric,
    COALESCE(ROUND(AVG(NULLIF(vc.latest_score - vc.first_score, 0))::numeric, 1), 0)::numeric,
    COALESCE(SUM(CASE WHEN vc.latest_score >= 90 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN vc.latest_score < 90 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(vc.total_minutes), 0)::int,
    (SELECT COUNT(*)::int FROM public.saved_words sw
      WHERE sw.user_id = uid AND sw.state = 'green'
        AND (lang IS NULL OR sw.language = lang))
  FROM public.video_comprehension vc
  WHERE vc.user_id = uid
    AND (lang IS NULL OR vc.language = lang);
END;
$function$;