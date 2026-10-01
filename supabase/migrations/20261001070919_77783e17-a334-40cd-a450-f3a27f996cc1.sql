CREATE OR REPLACE FUNCTION public.claim_daily_chest()
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_uid uuid := auth.uid(); v_run integer := 0; v_today date; d date; v_gems integer; v_new integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  v_today := public.local_today(v_uid);
  IF NOT EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = v_uid AND date IN (v_today, current_date) AND goal_met) THEN
    RAISE EXCEPTION 'Goal not met today';
  END IF;
  d := v_today;
  WHILE v_run < 7 AND EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = v_uid AND date = d AND goal_met) LOOP
    v_run := v_run + 1; d := d - 1;
  END LOOP;
  v_gems := (ARRAY[10,15,20,25,30,40,60])[GREATEST(v_run,1)];
  INSERT INTO public.reward_claims (user_id, kind, key, gems)
  VALUES (v_uid, 'daily', v_today::text, v_gems) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  RETURN json_build_object('gems', v_gems, 'run', v_run, 'already', v_new = 0,
    'balance', public.recompute_gems(v_uid));
END; $function$;