CREATE OR REPLACE FUNCTION public.frequency_coverage(_language text)
 RETURNS TABLE(band integer, known_words integer, total_words integer, pct numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH bands(band) AS (
    SELECT g FROM generate_series(50, 3000, 50) g
  ), ranked AS (
    SELECT cv.rank, lower(cv.word) AS w, row_number() OVER (ORDER BY cv.rank) AS pos
      FROM public.core_vocabulary cv WHERE cv.language = _language
  ), greens AS (
    SELECT sw.frequency_rank, lower(sw.word) AS w
      FROM public.saved_words sw
     WHERE sw.user_id = auth.uid() AND sw.language = _language AND sw.state = 'green'
  ), known AS (
    SELECT r.pos FROM ranked r
     WHERE r.pos <= 3000 AND EXISTS (SELECT 1 FROM greens g WHERE g.frequency_rank = r.rank OR g.w = r.w)
  )
  SELECT b.band,
         LEAST((SELECT count(*) FROM known k WHERE k.pos <= b.band), b.band)::int,
         LEAST((SELECT count(*) FROM ranked r WHERE r.pos <= b.band), b.band)::int,
         CASE WHEN (SELECT count(*) FROM ranked r WHERE r.pos <= b.band) = 0 THEN 0
              ELSE round(100.0 * (SELECT count(*) FROM known k WHERE k.pos <= b.band)
                   / LEAST((SELECT count(*) FROM ranked r WHERE r.pos <= b.band), b.band), 1)
         END
    FROM bands b
   ORDER BY b.band;
$function$;