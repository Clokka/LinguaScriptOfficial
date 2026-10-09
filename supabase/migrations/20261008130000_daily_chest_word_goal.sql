-- The daily chest is the reward for today's word goal: the "Today's goal
-- 8/8 words" the learner sees counts words ADDED (saved_words). The chest
-- used to open only once the review-based streak goal (activity_log.goal_met)
-- was met, so reaching 8/8 added words gave no chest. Either goal now counts.
--
-- Mirrors useDailyWordGoal: words pre-marked known at setup are parked at
-- next_review 2999-01-01 and don't count; the goal is profiles.daily_word_goal,
-- else 10/20/40 by daily_video_goal (wordGoalForVideos). "Today" is the last
-- 24 hours, so learners in any time zone can open the chest the moment the
-- app shows the goal reached.
CREATE OR REPLACE FUNCTION public.daily_word_goal_reached(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (
    SELECT COUNT(*) FROM public.saved_words
    WHERE user_id = _uid
      AND created_at >= now() - interval '24 hours'
      AND next_review < '2999-01-01'
  ) >= (
    SELECT COALESCE(p.daily_word_goal,
      CASE WHEN COALESCE(p.daily_video_goal, 1) <= 1 THEN 10
           WHEN p.daily_video_goal = 2 THEN 20 ELSE 40 END)
    FROM public.profiles p WHERE p.user_id = _uid
  );
$$;
REVOKE ALL ON FUNCTION public.daily_word_goal_reached(uuid) FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_daily_chest()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_run integer := 0; d date := current_date; v_gems integer; v_new integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = v_uid AND date = current_date AND goal_met)
     AND NOT COALESCE(public.daily_word_goal_reached(v_uid), false) THEN
    RAISE EXCEPTION 'Goal not met today';
  END IF;
  -- Days in a row with a chest (or a met streak goal) make today's chest bigger.
  v_run := 1; d := current_date - 1;
  WHILE v_run < 7 AND (
    EXISTS (SELECT 1 FROM public.activity_log WHERE user_id = v_uid AND date = d AND goal_met)
    OR EXISTS (SELECT 1 FROM public.reward_claims WHERE user_id = v_uid AND kind = 'daily' AND key = d::text)
  ) LOOP
    v_run := v_run + 1; d := d - 1;
  END LOOP;
  v_gems := (ARRAY[10,15,20,25,30,40,60])[v_run];
  INSERT INTO public.reward_claims (user_id, kind, key, gems)
  VALUES (v_uid, 'daily', current_date::text, v_gems) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_new = ROW_COUNT;
  RETURN json_build_object('gems', v_gems, 'run', v_run, 'already', v_new = 0,
    'balance', public.recompute_gems(v_uid));
END; $$;
