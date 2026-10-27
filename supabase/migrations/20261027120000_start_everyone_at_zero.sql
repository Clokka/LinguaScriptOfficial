-- Every learner starts at zero known words, whatever level they pick.
-- Pre-marking the top ~1,200 words green for "A2" made beginners feel behind
-- and filled half the common-words decks on day one. The app no longer calls
-- this; it stays as a no-op so an old open tab can't seed words either.
CREATE OR REPLACE FUNCTION public.seed_known_vocabulary(_language text, _level text, _mode text DEFAULT 'fluency'::text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN 0;
END;
$function$;
