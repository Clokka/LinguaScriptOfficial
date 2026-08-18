-- Seeded vocabulary is born already-claimed — it never turns gold.
--
-- Depends on 20260810090000_golden_reveal.sql, which adds green_revealed_at.
--
-- The Golden Reveal celebrates a word the learner *earned*: they met it, drilled
-- it, and pushed it into the green deck. `seed_known_vocabulary` puts words in
-- the green deck for the opposite reason — the system *assumes* the learner
-- already knows them because of the CEFR level they picked. There is nothing to
-- celebrate and nothing to witness, so those words must skip gold entirely.
--
-- Left alone this is not a small blemish, it swamps the feature. The seed takes
-- the highest-frequency words in the language: 25% of core vocabulary at A2, 50%
-- at B1, 98% at C2. Those are exactly the words that appear in every subtitle
-- line. A new B1 learner would open their first video to a screen of gold, with
-- a claim jingle queued behind each one — turning a rare reward into the default
-- state of the app, on day one, before they had learned anything at all.
--
-- Stamping green_revealed_at at insert time is what makes the distinction
-- structural rather than a rule someone has to remember. `isPendingGreen`
-- compares green_revealed_at against state_changed_at, so a seeded word is
-- claimed the instant it exists — and, importantly, still re-arms normally if it
-- is ever demoted to orange and re-earned later. Nothing is permanently
-- disqualified from gold; it just cannot arrive holding it.

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
    INSERT INTO public.saved_words
      (user_id, word, translation, language, state, state_changed_at, green_revealed_at)
    -- Same now() for both: isPendingGreen only treats a word as gold when the
    -- reveal is strictly older than the promotion, so equal timestamps mean
    -- "already witnessed".
    SELECT auth.uid(), tw.word, tw.translation, _language, 'green', now(), now()
      FROM top_words tw
    ON CONFLICT DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted FROM ins;

  RETURN inserted;
END;
$function$;

-- Backfill: learners who onboarded before this migration already hold seeded
-- green words with green_revealed_at NULL, and would get the day-one gold flood
-- described above the moment the Golden Reveal ships.
--
-- Identifying a seeded row takes more care than "never reviewed". Marking a word
-- known from the player also writes green with times_correct still 0, so that
-- test alone would quietly claim the reveals a learner deliberately earned —
-- the one outcome worth avoiding here.
--
-- The reliable signal is the timestamps. The seed writes state_changed_at with
-- the same now() that fills the created_at default, and now() is fixed for the
-- transaction, so every seeded row has the two exactly equal. Marking a word
-- known sends state_changed_at from the browser clock while created_at comes
-- from the database, so those two never coincide — they differ by network
-- latency and clock skew.
--
-- The untouched counters stay as a second condition. Between the two, this can
-- only fail by leaving a seeded word gold, never by stealing an earned reveal.
UPDATE public.saved_words
   SET green_revealed_at = created_at
 WHERE state = 'green'
   AND green_revealed_at IS NULL
   AND state_changed_at = created_at
   AND review_count = 0
   AND times_correct = 0
   AND last_reviewed_at IS NULL;
