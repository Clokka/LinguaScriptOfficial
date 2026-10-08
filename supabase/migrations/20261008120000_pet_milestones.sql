-- Milestone pets, matching the unlock labels in src/lib/pets.ts:
--   Muskrat  — 7-day streak
--   Pudu     — watch 10 videos
--   Herring  — watch 25 videos
-- Nothing granted these before (Pudu/Herring had no unlock path at all, and
-- Muskrat only came from a manually claimed 14-day streak reward). The client
-- calls this when the app opens, after the daily chest and after a video;
-- it grants any pet the learner has earned and returns the new ones.
-- Gem pets stay in the gem shop (buy_shop_item); chests never contain pets.
CREATE OR REPLACE FUNCTION public.claim_pet_milestones()
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_streak integer;
  v_videos integer;
  v_new text[] := '{}';
  r record;
BEGIN
  IF v_uid IS NULL THEN RETURN v_new; END IF;
  SELECT COALESCE(streak_count, 0) INTO v_streak FROM public.profiles WHERE user_id = v_uid;
  SELECT COUNT(DISTINCT film_id) INTO v_videos FROM public.watch_sessions WHERE user_id = v_uid;

  FOR r IN
    SELECT * FROM (VALUES
      ('muskrat', COALESCE(v_streak, 0) >= 7),
      ('pudu', v_videos >= 10),
      ('herring', v_videos >= 25)
    ) AS t(pet_id, earned)
  LOOP
    IF r.earned AND NOT EXISTS (
      SELECT 1 FROM public.pet_collection WHERE user_id = v_uid AND pet_id = r.pet_id
    ) THEN
      INSERT INTO public.pet_collection (user_id, pet_id) VALUES (v_uid, r.pet_id);
      v_new := v_new || r.pet_id;
    END IF;
  END LOOP;

  RETURN v_new;
END; $$;

REVOKE ALL ON FUNCTION public.claim_pet_milestones() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.claim_pet_milestones() TO authenticated;
