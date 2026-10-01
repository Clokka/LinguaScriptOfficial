ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

ALTER TABLE public.shop_items
  ADD COLUMN IF NOT EXISTS slot text,
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'common',
  ADD COLUMN IF NOT EXISTS unlock text NOT NULL DEFAULT 'shop',
  ADD COLUMN IF NOT EXISTS rule jsonb,
  ADD COLUMN IF NOT EXISTS glb_path text,
  ADD COLUMN IF NOT EXISTS description text;

UPDATE public.shop_items SET slot='feet', glb_path='/accessories/Sneakers.glb' WHERE id='sneakers';
UPDATE public.shop_items SET slot='head', glb_path='/accessories/TruckerHat.glb' WHERE id='trucker_hat';

INSERT INTO public.shop_items (id, kind, name, emoji, price, sort_order, slot, rarity, unlock, rule, description) VALUES
 ('flame_scarf','cosmetic','Flame scarf','🧣',0,100,'neck','uncommon','achievement','{"type":"streak","value":7}','Kept a 7-day streak'),
 ('streak_crown','cosmetic','Streak crown','👑',0,101,'head','rare','achievement','{"type":"streak","value":30}','Kept a 30-day streak'),
 ('hero_cape','cosmetic','Hero cape','🦸',0,102,'back','epic','achievement','{"type":"streak","value":100}','Kept a 100-day streak'),
 ('scholar_glasses','cosmetic','Scholar glasses','🤓',0,103,'face','rare','achievement','{"type":"words","value":500}','Learned 500 words'),
 ('cinema_headphones','cosmetic','Cinema headphones','🎧',0,104,'head','rare','achievement','{"type":"minutes","value":600}','Watched 10 hours'),
 ('green_aura','effect','Green aura','✨',0,105,'effect','epic','achievement','{"type":"band","value":1000}','Knows the top 1,000 words'),
 ('gold_pattern','pattern','Gold pattern','🌟',0,106,'pattern','epic','achievement','{"type":"level","value":25}','Reached level 25'),
 ('rainbow_pattern','pattern','Rainbow pattern','🌈',0,107,'pattern','legendary','achievement','{"type":"level","value":50}','Reached level 50')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.local_today(_uid uuid)
RETURNS date LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (now() AT TIME ZONE COALESCE(
    (SELECT CASE WHEN timezone IN (SELECT name FROM pg_timezone_names) THEN timezone END FROM public.profiles WHERE user_id=_uid),
    'UTC'))::date
$$;

CREATE OR REPLACE FUNCTION public.local_midnight(_uid uuid)
RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (public.local_today(_uid)::timestamp) AT TIME ZONE COALESCE(
    (SELECT CASE WHEN timezone IN (SELECT name FROM pg_timezone_names) THEN timezone END FROM public.profiles WHERE user_id=_uid),'UTC')
$$;

-- Lock progression columns from direct client writes.
CREATE OR REPLACE FUNCTION public.protect_reward_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated','anon') THEN
    NEW.gems := OLD.gems;
    NEW.gems_spent := OLD.gems_spent;
    NEW.streak_freezes := OLD.streak_freezes;
    NEW.xp_total := OLD.xp_total;
    NEW.xp_level := OLD.xp_level;
    NEW.streak_count := OLD.streak_count;
    NEW.last_streak_date := OLD.last_streak_date;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_reward_columns ON public.profiles;
CREATE TRIGGER protect_reward_columns BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_reward_columns();

-- Server-validated XP grant.
CREATE OR REPLACE FUNCTION public.grant_xp(p_action text, p_amount integer, p_level integer, p_meta jsonb DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_max int; v_today_sum int; v_amt int; v_total int; v_lvl int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_max := CASE p_action
    WHEN 'add_word' THEN 20 WHEN 'review_card' THEN 10 WHEN 'video_watch' THEN 10
    WHEN 'reinforcement' THEN 5 WHEN 'line_blast' THEN 150 WHEN 'session_end' THEN 25
    WHEN 'daily_goal_reached' THEN 1500 WHEN 'return_gift' THEN 10 WHEN 'mission_bonus' THEN 50
    ELSE 0 END;
  IF v_max = 0 THEN RAISE EXCEPTION 'Unknown action'; END IF;
  IF p_action IN ('daily_goal_reached','mission_bonus','return_gift') AND EXISTS (
    SELECT 1 FROM public.xp_events WHERE user_id=v_uid AND action=p_action AND created_at >= public.local_midnight(v_uid)) THEN
    RETURN json_build_object('granted',0,'already',true);
  END IF;
  IF p_action = 'mission_bonus' AND NOT EXISTS (
    SELECT 1 FROM public.activity_log WHERE user_id=v_uid AND goal_met AND date >= public.local_today(v_uid) - 1) THEN
    RAISE EXCEPTION 'Goal not met';
  END IF;
  SELECT COALESCE(SUM(amount),0) INTO v_today_sum FROM public.xp_events
   WHERE user_id=v_uid AND created_at >= public.local_midnight(v_uid);
  v_amt := GREATEST(0, LEAST(COALESCE(p_amount,0), v_max, 6000 - v_today_sum));
  IF v_amt = 0 THEN RETURN json_build_object('granted',0,'capped',true); END IF;
  INSERT INTO public.xp_events (user_id, action, amount, meta) VALUES (v_uid, p_action, v_amt, p_meta);
  UPDATE public.profiles SET xp_total = COALESCE(xp_total,0) + v_amt,
    xp_level = GREATEST(COALESCE(xp_level,1), LEAST(COALESCE(p_level,1), COALESCE(xp_level,1) + 2))
   WHERE user_id = v_uid RETURNING xp_total, xp_level INTO v_total, v_lvl;
  RETURN json_build_object('granted', v_amt, 'xp_total', v_total, 'xp_level', v_lvl);
END $$;

-- Daily return gift: small, once per local day, grows over a 7-day run.
CREATE OR REPLACE FUNCTION public.claim_return_gift()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_today date; v_run int := 1; d date; v_gems int; v_new int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_today := public.local_today(v_uid);
  d := v_today - 1;
  WHILE v_run < 7 AND EXISTS (SELECT 1 FROM public.reward_claims WHERE user_id=v_uid AND kind='return' AND key=d::text) LOOP
    v_run := v_run + 1; d := d - 1;
  END LOOP;
  v_gems := (ARRAY[5,5,10,10,15,15,30])[v_run];
  INSERT INTO public.reward_claims (user_id, kind, key, gems) VALUES (v_uid,'return',v_today::text,v_gems) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  RETURN json_build_object('gems', v_gems, 'run', v_run, 'already', v_new = 0, 'balance', public.recompute_gems(v_uid));
END $$;

-- Streak: kept by one real learning action today (server-checked), freeze bridges one missed day.
CREATE OR REPLACE FUNCTION public.keep_streak()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_today date; v_mid timestamptz; v_count int; v_last date; v_new int; v_freeze boolean := false; v_has boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_today := public.local_today(v_uid); v_mid := public.local_midnight(v_uid);
  SELECT COALESCE(streak_count,0), last_streak_date INTO v_count, v_last FROM public.profiles WHERE user_id=v_uid FOR UPDATE;
  IF v_last = v_today THEN RETURN json_build_object('streak', v_count, 'kept', true, 'already', true); END IF;
  v_has := EXISTS (SELECT 1 FROM public.xp_events WHERE user_id=v_uid AND created_at >= v_mid
                   AND action IN ('review_card','video_watch','line_blast','reinforcement','session_end'))
        OR EXISTS (SELECT 1 FROM public.linguascript_reviews WHERE user_id=v_uid AND created_at >= v_mid)
        OR EXISTS (SELECT 1 FROM public.activity_log WHERE user_id=v_uid AND date >= v_today - 1
                   AND (COALESCE(words_reviewed,0) > 0 OR COALESCE(minutes_watched,0) > 0) AND created_at >= v_mid - interval '1 day' AND date = v_today);
  IF NOT v_has THEN
    RETURN json_build_object('streak', CASE WHEN v_last >= v_today - 2 THEN v_count ELSE 0 END, 'kept', false);
  END IF;
  IF v_last = v_today - 2 AND v_count > 0 AND (SELECT streak_freezes FROM public.profiles WHERE user_id=v_uid) > 0 THEN
    UPDATE public.profiles SET streak_freezes = streak_freezes - 1 WHERE user_id=v_uid;
    v_freeze := true; v_last := v_today - 1;
  END IF;
  v_new := CASE WHEN v_last = v_today - 1 THEN v_count + 1 ELSE 1 END;
  UPDATE public.profiles SET streak_count = v_new, last_streak_date = v_today WHERE user_id = v_uid;
  RETURN json_build_object('streak', v_new, 'kept', true, 'already', false, 'freeze_used', v_freeze);
END $$;

-- Achievement cosmetics: granted once, checked server-side.
CREATE OR REPLACE FUNCTION public.check_achievements(p_language text DEFAULT NULL)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); it record; v_val numeric; v_streak int; v_level int; v_words int; v_min int; v_band int; v_new int; v_granted text[] := '{}';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  SELECT COALESCE(streak_count,0), COALESCE(xp_level,1) INTO v_streak, v_level FROM public.profiles WHERE user_id=v_uid;
  SELECT count(*) INTO v_words FROM public.saved_words WHERE user_id=v_uid AND state='green' AND next_review < DATE '2999-01-01';
  SELECT COALESCE(sum(position_seconds),0)/60 INTO v_min FROM public.watch_history WHERE user_id=v_uid;
  v_band := 0;
  IF p_language IS NOT NULL THEN
    SELECT COALESCE(max(band),0) INTO v_band FROM public.frequency_coverage(p_language) f WHERE f.known_words + f.assumed_words >= f.total_words AND f.total_words > 0;
  END IF;
  FOR it IN SELECT id, rule FROM public.shop_items WHERE unlock='achievement' AND rule IS NOT NULL LOOP
    v_val := CASE it.rule->>'type' WHEN 'streak' THEN v_streak WHEN 'level' THEN v_level
      WHEN 'words' THEN v_words WHEN 'minutes' THEN v_min WHEN 'band' THEN v_band ELSE 0 END;
    IF v_val >= (it.rule->>'value')::numeric THEN
      INSERT INTO public.reward_claims (user_id, kind, key, gems, item_id) VALUES (v_uid,'achievement',it.id,0,it.id) ON CONFLICT DO NOTHING;
      GET DIAGNOSTICS v_new = ROW_COUNT;
      IF v_new > 0 THEN
        INSERT INTO public.user_items (user_id, item_id) VALUES (v_uid, it.id) ON CONFLICT DO NOTHING;
        v_granted := v_granted || it.id;
      END IF;
    END IF;
  END LOOP;
  RETURN json_build_object('granted', v_granted);
END $$;

REVOKE EXECUTE ON FUNCTION public.grant_xp(text,integer,integer,jsonb), public.claim_return_gift(), public.keep_streak(), public.check_achievements(text), public.local_today(uuid), public.local_midnight(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.grant_xp(text,integer,integer,jsonb), public.claim_return_gift(), public.keep_streak(), public.check_achievements(text) TO authenticated;