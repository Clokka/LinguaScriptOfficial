DROP FUNCTION IF EXISTS public.frequency_coverage(text);
CREATE FUNCTION public.frequency_coverage(_language text)
 RETURNS TABLE(band integer, known_words integer, total_words integer, pct numeric, assumed_words integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH bands(band) AS (SELECT g FROM generate_series(50, 3000, 50) g),
  ranked AS (
    SELECT cv.rank, lower(cv.word) AS w, row_number() OVER (ORDER BY cv.rank) AS pos
      FROM public.core_vocabulary cv WHERE cv.language = _language
  ), greens AS (
    SELECT sw.frequency_rank, lower(sw.word) AS w, (sw.next_review >= DATE '2999-01-01') AS seeded
      FROM public.saved_words sw
     WHERE sw.user_id = auth.uid() AND sw.language = _language AND sw.state = 'green'
  ), known AS (
    SELECT r.pos FROM ranked r WHERE r.pos <= 3000 AND EXISTS
      (SELECT 1 FROM greens g WHERE NOT g.seeded AND (g.frequency_rank = r.rank OR g.w = r.w))
  ), assumed AS (
    SELECT r.pos FROM ranked r WHERE r.pos <= 3000 AND r.pos NOT IN (SELECT pos FROM known) AND EXISTS
      (SELECT 1 FROM greens g WHERE g.seeded AND (g.frequency_rank = r.rank OR g.w = r.w))
  )
  SELECT b.band,
    LEAST((SELECT count(*) FROM known k WHERE k.pos <= b.band), b.band)::int,
    LEAST((SELECT count(*) FROM ranked r WHERE r.pos <= b.band), b.band)::int,
    CASE WHEN (SELECT count(*) FROM ranked r WHERE r.pos <= b.band) = 0 THEN 0
      ELSE round(100.0 * (SELECT count(*) FROM known k WHERE k.pos <= b.band)
        / LEAST((SELECT count(*) FROM ranked r WHERE r.pos <= b.band), b.band), 1) END,
    (SELECT count(*) FROM assumed a WHERE a.pos <= b.band)::int
  FROM bands b ORDER BY b.band;
$function$;
REVOKE ALL ON FUNCTION public.frequency_coverage(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.frequency_coverage(text) TO authenticated;