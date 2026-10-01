CREATE OR REPLACE FUNCTION public.frequency_coverage(_language text)
 RETURNS TABLE(band integer, known_words integer, total_words integer, pct numeric, assumed_words integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH ranked AS (
    SELECT cv.rank, lower(cv.word) AS w, row_number() OVER (ORDER BY cv.rank) AS pos
      FROM public.core_vocabulary cv WHERE cv.language = _language
      ORDER BY cv.rank LIMIT 3000
  ), greens AS (
    SELECT sw.frequency_rank, lower(sw.word) AS w, (sw.next_review >= DATE '2999-01-01') AS seeded
      FROM public.saved_words sw
     WHERE sw.user_id = auth.uid() AND sw.language = _language AND sw.state = 'green'
  ), matched AS (
    SELECT r.pos, bool_or(NOT g.seeded) AS learned
      FROM ranked r JOIN greens g ON g.w = r.w OR g.frequency_rank = r.rank
     GROUP BY r.pos
  ), per AS (
    SELECT r.pos, COALESCE(m.learned, false) AS k, (m.pos IS NOT NULL AND NOT m.learned) AS a
      FROM ranked r LEFT JOIN matched m ON m.pos = r.pos
  )
  SELECT b.g::int,
    count(*) FILTER (WHERE p.k)::int,
    count(p.pos)::int,
    CASE WHEN count(p.pos)=0 THEN 0 ELSE round(100.0*count(*) FILTER (WHERE p.k)/count(p.pos),1) END,
    count(*) FILTER (WHERE p.a)::int
  FROM generate_series(50,3000,50) b(g) LEFT JOIN per p ON p.pos <= b.g
  GROUP BY b.g ORDER BY b.g;
$function$;