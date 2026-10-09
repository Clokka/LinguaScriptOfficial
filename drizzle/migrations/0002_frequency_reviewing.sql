CREATE OR REPLACE FUNCTION public.frequency_reviewing(_language text)
RETURNS TABLE(band integer, reviewing_words integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT cv.rank, lower(cv.word) AS w, row_number() OVER (ORDER BY cv.rank) AS pos
      FROM public.core_vocabulary cv WHERE cv.language = _language
      ORDER BY cv.rank LIMIT 3000
  ), org AS MATERIALIZED (
    SELECT lower(sw.word) AS w FROM public.saved_words sw
     WHERE sw.user_id = auth.uid() AND sw.language = _language AND sw.state = 'orange'
  ), hit AS (
    SELECT DISTINCT r.pos FROM ranked r JOIN org o ON o.w = r.w
  )
  SELECT b.g::int, count(h.pos)::int
    FROM generate_series(50,3000,50) b(g) LEFT JOIN hit h ON h.pos <= b.g
   GROUP BY b.g ORDER BY b.g;
$function$;
REVOKE ALL ON FUNCTION public.frequency_reviewing(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.frequency_reviewing(text) TO authenticated;