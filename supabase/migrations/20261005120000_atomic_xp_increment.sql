-- Add XP on the server instead of letting each device overwrite the total.
-- Before this, every award wrote the device's in-memory total to
-- profiles.xp_total, so a tab left open since yesterday (or a second device)
-- wiped out everything earned elsewhere — learners kept "re-reaching" the
-- same level every day. Adding the delta server-side can never lose XP.
CREATE OR REPLACE FUNCTION public.increment_xp(p_amount integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_total integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  -- The daily-goal bonus tops up to the next level, so allow large but sane grants.
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount > 50000 THEN
    RAISE EXCEPTION 'invalid xp amount %', p_amount;
  END IF;
  UPDATE public.profiles
     SET xp_total = COALESCE(xp_total, 0) + p_amount
   WHERE user_id = v_uid
  RETURNING xp_total INTO v_total;
  RETURN v_total;
END; $$;

REVOKE EXECUTE ON FUNCTION public.increment_xp(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_xp(integer) TO authenticated;
