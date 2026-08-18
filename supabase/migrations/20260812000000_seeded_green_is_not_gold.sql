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
-- Claim the entire pre-existing green deck, seeded or earned alike.
--
-- Every green word that exists at this moment was promoted before the Golden
-- Reveal did, and the learner already watched it turn green in the old UI.
-- There is no reveal owed: the mechanic cannot retroactively grant a moment
-- that already happened. Gold starts from the next promotion.
--
-- An earlier version of this tried to claim only the seeded rows, on the theory
-- that seeded words have state_changed_at exactly equal to created_at while
-- earned ones don't. It matched zero rows in production, and the reasoning was
-- backwards: created_at is when a word was saved and state_changed_at is when
-- it was later promoted, so they differ for every word anybody actually
-- learned. Worse, the distinction didn't matter — on the real data the backlog
-- was 896 words, 664 of them on a single account, and almost none of them
-- seeded. Leaving earned words gold would have buried a new mechanic under
-- months of accumulated history on its first frame.
UPDATE public.saved_words
   SET green_revealed_at = COALESCE(state_changed_at, created_at, now())
 WHERE state = 'green'
   AND green_revealed_at IS NULL;
