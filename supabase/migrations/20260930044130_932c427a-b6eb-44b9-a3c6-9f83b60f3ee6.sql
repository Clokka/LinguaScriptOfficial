ALTER FUNCTION public.level_reward_gems(integer) SET search_path = public;
GRANT SELECT ON public.level_rewards TO authenticated;
GRANT ALL ON public.level_rewards TO service_role;
REVOKE EXECUTE ON FUNCTION public.sync_level_rewards(integer) FROM anon;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_freezes integer NOT NULL DEFAULT 0;

CREATE TABLE public.reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  key text NOT NULL,
  gems integer NOT NULL DEFAULT 0,
  item_id text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, key)
);
GRANT SELECT ON public.reward_claims TO authenticated;
GRANT ALL ON public.reward_claims TO service_role;
ALTER TABLE public.reward_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own reward claims" ON public.reward_claims FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.user_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, item_id)
);
GRANT SELECT ON public.user_items TO authenticated;
GRANT ALL ON public.user_items TO service_role;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own items" ON public.user_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.shop_items (
  id text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '',
  price integer NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.shop_items TO anon, authenticated;
GRANT ALL ON public.shop_items TO service_role;
ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop items are public" ON public.shop_items FOR SELECT USING (true);

INSERT INTO public.shop_items (id, kind, name, emoji, price, sort_order) VALUES
  ('streak_freeze','freeze','Streak freeze','🧊',100,1),
  ('sneakers','accessory','Cartoon Sneakers','👟',150,2),
  ('trucker_hat','accessory','Trucker Hat','🧢',150,3),
  ('colobus','pet','Colobus','🐒',200,4),
  ('inkfish','pet','Inkfish','🦑',1000,5);

-- Protect currency columns from direct client edits.
CREATE OR REPLACE FUNCTION public.protect_reward_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    NEW.gems := OLD.gems;
    NEW.gems_spent := OLD.gems_spent;
    NEW.streak_freezes := OLD.streak_freezes;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER protect_reward_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_reward_columns();

CREATE OR REPLACE FUNCTION public.recompute_gems(_uid uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v integer;
BEGIN
  UPDATE public.profiles p SET gems = GREATEST(0,
      COALESCE((SELECT SUM(gems) FROM public.level_rewards WHERE user_id = _uid),0)
    + COALESCE((SELECT SUM(gems) FROM public.reward_claims WHERE user_id = _uid),0)
    - COALESCE(p.gems_spent,0))
  WHERE p.user_id = _uid RETURNING p.gems INTO v;
  RETURN COALESCE(v,0);
END; $$;
REVOKE ALL ON FUNCTION public.recompute_gems(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_level_rewards(p_level integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN 0; END IF;
  p_level := LEAST(GREATEST(COALESCE(p_level,1),1),500);
  IF p_level >= 2 THEN
    INSERT INTO public.level_rewards (user_id, level, gems)
    SELECT v_uid, g.n, public.level_reward_gems(g.n) FROM generate_series(2,p_level) g(n)
    ON CONFLICT (user_id, level) DO NOTHING;
  END IF;
  RETURN public.recompute_gems(v_uid);
END; $$;

-- Fixed item per level. Mirrors LEVEL_ITEMS in src/lib/levelRewards.ts.
CREATE OR REPLACE FUNCTION public.level_box_item(p_level integer)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_level WHEN 5 THEN 'sneakers' WHEN 10 THEN 'colobus'
    WHEN 15 THEN 'trucker_hat' WHEN 20 THEN 'inkfish' ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION public.grant_item(_uid uuid, _item text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _item IS NULL THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.shop_items WHERE id = _item AND kind = 'pet')
     OR _item = 'muskrat' THEN
    INSERT INTO public.pet_collection (user_id, pet_id)
    SELECT _uid, _item WHERE NOT EXISTS
      (SELECT 1 FROM public.pet_collection WHERE user_id = _uid AND pet_id = _item);
  ELSIF _item = 'streak_freeze' THEN
    UPDATE public.profiles SET streak_freezes = LEAST(2, streak_freezes + 1) WHERE user_id = _uid;
  ELSE
    INSERT INTO public.user_items (user_id, item_id) VALUES (_uid, _item) ON CONFLICT DO NOTHING;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION public.grant_item(uuid, text) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_level_box(p_level integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_lvl integer; v_item text; v_new integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT xp_level INTO v_lvl FROM public.profiles WHERE user_id = v_uid;
  IF p_level < 2 OR p_level > COALESCE(v_lvl,1) THEN RAISE EXCEPTION 'Level not reached'; END IF;
  v_item := public.level_box_item(p_level);
  INSERT INTO public.reward_claims (user_id, kind, key, gems, item_id)
  VALUES (v_uid, 'level', p_level::text, 0, v_item) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  IF v_new > 0 THEN PERFORM public.grant_item(v_uid, v_item); END IF;
  PERFORM public.sync_level_rewards(v_lvl);
  RETURN json_build_object('level', p_level, 'gems', public.level_reward_gems(p_level),
    'item_id', v_item, 'already', v_new = 0,
    'balance', (SELECT gems FROM public.profiles WHERE user_id = v_uid));
END; $$;

CREATE OR REPLACE FUNCTION public.claim_streak_reward(p_days integer)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_streak integer; v_gems integer; v_item text; v_new integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT streak_count INTO v_streak FROM public.profiles WHERE user_id = v_uid;
  IF COALESCE(v_streak,0) < p_days THEN RAISE EXCEPTION 'Streak not reached'; END IF;
  SELECT g, i INTO v_gems, v_item FROM (VALUES
    (3,30,NULL::text),(7,75,'streak_freeze'),(14,100,'muskrat'),
    (30,250,'streak_freeze'),(60,400,NULL),(100,1000,'streak_freeze')) t(d,g,i)
  WHERE d = p_days;
  IF v_gems IS NULL THEN RAISE EXCEPTION 'Unknown milestone'; END IF;
  INSERT INTO public.reward_claims (user_id, kind, key, gems, item_id)
  VALUES (v_uid, 'streak', p_days::text, v_gems, v_item) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  IF v_new > 0 THEN PERFORM public.grant_item(v_uid, v_item); END IF;
  RETURN json_build_object('gems', v_gems, 'item_id', v_item, 'already', v_new = 0,
    'balance', public.recompute_gems(v_uid));
END; $$;

CREATE OR REPLACE FUNCTION public.claim_daily_chest()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_run integer := 0; d date := current_date; v_gems integer; v_new integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = v_uid AND date = current_date AND goal_met) THEN
    RAISE EXCEPTION 'Goal not met today';
  END IF;
  WHILE v_run < 7 AND EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = v_uid AND date = d AND goal_met) LOOP
    v_run := v_run + 1; d := d - 1;
  END LOOP;
  v_gems := (ARRAY[10,15,20,25,30,40,60])[GREATEST(v_run,1)];
  INSERT INTO public.reward_claims (user_id, kind, key, gems)
  VALUES (v_uid, 'daily', current_date::text, v_gems) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  RETURN json_build_object('gems', v_gems, 'run', v_run, 'already', v_new = 0,
    'balance', public.recompute_gems(v_uid));
END; $$;

CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item text)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_item public.shop_items; v_gems integer; v_freezes integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT * INTO v_item FROM public.shop_items WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown item'; END IF;
  SELECT gems, streak_freezes INTO v_gems, v_freezes FROM public.profiles WHERE user_id = v_uid FOR UPDATE;
  IF v_gems < v_item.price THEN RAISE EXCEPTION 'Not enough gems'; END IF;
  IF v_item.kind = 'freeze' AND v_freezes >= 2 THEN RAISE EXCEPTION 'You already hold 2 streak freezes'; END IF;
  IF v_item.kind = 'pet' AND EXISTS (SELECT 1 FROM public.pet_collection WHERE user_id = v_uid AND pet_id = p_item) THEN
    RAISE EXCEPTION 'Already owned'; END IF;
  IF v_item.kind = 'accessory' AND EXISTS (SELECT 1 FROM public.user_items WHERE user_id = v_uid AND item_id = p_item) THEN
    RAISE EXCEPTION 'Already owned'; END IF;
  UPDATE public.profiles SET gems_spent = gems_spent + v_item.price WHERE user_id = v_uid;
  PERFORM public.grant_item(v_uid, p_item);
  RETURN json_build_object('balance', public.recompute_gems(v_uid));
END; $$;

CREATE OR REPLACE FUNCTION public.use_streak_freeze()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  UPDATE public.profiles SET streak_freezes = streak_freezes - 1, last_streak_date = current_date - 1
  WHERE user_id = v_uid AND streak_freezes > 0 AND last_streak_date = current_date - 2 AND streak_count > 0;
  RETURN FOUND;
END; $$;

REVOKE ALL ON FUNCTION public.open_level_box(integer), public.claim_streak_reward(integer),
  public.claim_daily_chest(), public.buy_shop_item(text), public.use_streak_freeze() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.open_level_box(integer), public.claim_streak_reward(integer),
  public.claim_daily_chest(), public.buy_shop_item(text), public.use_streak_freeze() TO authenticated;