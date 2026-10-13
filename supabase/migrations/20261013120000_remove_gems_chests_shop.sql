-- Remove the gems / chests / gem shop / streak freeze reward layer.
-- Levelling up the chameleon is the reward now. Pets already in
-- pet_collection (including Colobus and Inkfish bought or won before) are kept.
--
-- Colobus and Inkfish used to cost gems; they now unlock at level 10 and 20
-- (matches src/lib/pets.ts), granted by claim_pet_milestones like the
-- streak and video pets.

-- Functions first (some reference the tables and columns below).
DROP FUNCTION IF EXISTS public.open_level_box(integer);
DROP FUNCTION IF EXISTS public.claim_streak_reward(integer);
DROP FUNCTION IF EXISTS public.claim_daily_chest();
DROP FUNCTION IF EXISTS public.buy_shop_item(text);
DROP FUNCTION IF EXISTS public.use_streak_freeze();
DROP FUNCTION IF EXISTS public.grant_item(uuid, text);
DROP FUNCTION IF EXISTS public.level_box_item(integer);
DROP FUNCTION IF EXISTS public.sync_level_rewards(integer);
DROP FUNCTION IF EXISTS public.recompute_gems(uuid);
DROP FUNCTION IF EXISTS public.level_reward_gems(integer);
DROP FUNCTION IF EXISTS public.daily_word_goal_reached(uuid);

DROP TRIGGER IF EXISTS protect_reward_columns ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_reward_columns();

DROP TABLE IF EXISTS public.reward_claims;
DROP TABLE IF EXISTS public.user_items;
DROP TABLE IF EXISTS public.shop_items;
DROP TABLE IF EXISTS public.level_rewards;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS gems,
  DROP COLUMN IF EXISTS gems_spent,
  DROP COLUMN IF EXISTS streak_freezes;

-- Milestone pets: level 10 / 20, 7-day streak, 10 / 25 videos watched.
CREATE OR REPLACE FUNCTION public.claim_pet_milestones()
RETURNS text[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_level integer;
  v_streak integer;
  v_videos integer;
  v_new text[] := '{}';
  r record;
BEGIN
  IF v_uid IS NULL THEN RETURN v_new; END IF;
  SELECT COALESCE(xp_level, 1), COALESCE(streak_count, 0) INTO v_level, v_streak
    FROM public.profiles WHERE user_id = v_uid;
  SELECT COUNT(DISTINCT film_id) INTO v_videos FROM public.watch_sessions WHERE user_id = v_uid;

  FOR r IN
    SELECT * FROM (VALUES
      ('colobus', COALESCE(v_level, 1) >= 10),
      ('inkfish', COALESCE(v_level, 1) >= 20),
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
