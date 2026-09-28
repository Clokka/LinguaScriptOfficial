CREATE OR REPLACE FUNCTION public.frequency_coverage(_language text)
RETURNS TABLE(band integer, known_words integer, total_words integer, pct numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH bands(band) AS (
    SELECT g FROM generate_series(50, 1000, 50) g
    UNION ALL VALUES (1500),(2000),(3000),(5000),(10000),(20000)
  ), ranked AS (
    SELECT cv.rank, row_number() OVER (ORDER BY cv.rank) AS pos
      FROM public.core_vocabulary cv WHERE cv.language = _language
  ), known AS (
    SELECT r.pos
      FROM public.saved_words sw
      JOIN ranked r ON r.rank = sw.frequency_rank
     WHERE sw.user_id = auth.uid()
       AND sw.language = _language
       AND sw.state = 'green'
  )
  SELECT b.band,
         LEAST((SELECT count(DISTINCT k.pos) FROM known k WHERE k.pos <= b.band), b.band)::int,
         LEAST((SELECT count(*) FROM ranked r WHERE r.pos <= b.band), b.band)::int,
         CASE WHEN (SELECT count(*) FROM ranked r WHERE r.pos <= b.band) = 0 THEN 0
              ELSE round(100.0 * (SELECT count(DISTINCT k.pos) FROM known k WHERE k.pos <= b.band)
                   / LEAST((SELECT count(*) FROM ranked r WHERE r.pos <= b.band), b.band), 1)
         END
    FROM bands b
   ORDER BY b.band;
$$;
REVOKE EXECUTE ON FUNCTION public.frequency_coverage(text) FROM anon;