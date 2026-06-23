ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS daily_video_goal integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS daily_word_goal integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS streak_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_streak_date date,
  ADD COLUMN IF NOT EXISTS show_daily_briefing boolean NOT NULL DEFAULT true;

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS words_reviewed integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS goal_met boolean NOT NULL DEFAULT false;