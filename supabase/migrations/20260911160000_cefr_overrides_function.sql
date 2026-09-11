-- Real CEFR-labelled vocabulary, not just frequency-rank bands.
--
-- core_vocabulary.cefr_level today is a heuristic: bucket by frequency rank
-- (rank<=600 -> a1, <=1200 -> a2, ...). That's a defensible stand-in where
-- nothing better exists, but for languages with an actual academically
-- graded wordlist, the real label beats the frequency guess — a word can be
-- common in subtitles yet grammatically/conceptually advanced, or rare in
-- subtitles yet A1 (e.g. classroom vocabulary like "ruler" or "blackboard").
--
-- This function applies real labels on top of the frequency-seeded table:
-- update cefr_level in place for words already present (keeping their real
-- rank/frequency data), and insert a new row — ranked just past the current
-- max so it doesn't collide with real frequency ranks — for graded words the
-- frequency list didn't happen to include.
--
-- Restricted to service_role: it overwrites a shared reference table's
-- correctness for every learner, not a per-user action, so it's driven by
-- scripts/apply-cefr-overrides.ts using the service role key, never by an
-- authenticated user's own session.
CREATE OR REPLACE FUNCTION public.apply_cefr_overrides(_language text, _entries jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  next_rank integer;
  applied integer := 0;
  entry jsonb;
  w text;
  lvl text;
  p text;
  match_count integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF _language IS NULL OR length(trim(_language)) = 0 THEN RETURN 0; END IF;

  SELECT coalesce(max(rank), 0) + 1 INTO next_rank
    FROM public.core_vocabulary WHERE language = _language;

  FOR entry IN SELECT * FROM jsonb_array_elements(_entries)
  LOOP
    w := lower(trim(entry->>'word'));
    lvl := lower(trim(entry->>'level'));
    p := nullif(trim(entry->>'pos'), '');
    IF w = '' OR lvl NOT IN ('a1','a2','b1','b2','c1','c2') THEN
      CONTINUE;
    END IF;

    UPDATE public.core_vocabulary
       SET cefr_level = lvl
     WHERE language = _language AND lower(lemma) = w;
    GET DIAGNOSTICS match_count = ROW_COUNT;

    IF match_count = 0 THEN
      INSERT INTO public.core_vocabulary
        (language, rank, word, lemma, translation, pos, frequency_weight, cefr_level)
      VALUES (_language, next_rank, w, w, NULL, p, 0, lvl)
      ON CONFLICT (language, lemma) DO UPDATE SET cefr_level = excluded.cefr_level;
      next_rank := next_rank + 1;
    END IF;

    applied := applied + 1;
  END LOOP;

  RETURN applied;
END;
$function$;
