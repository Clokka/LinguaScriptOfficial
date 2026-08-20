-- Daily quest: save 5 -> celebrate -> review -> build.
--
-- activity_log.words_reviewed already means "flashcards graded on the
-- legacy /flashcards page" (see the R2 streak work) and reusing it for
-- "words saved today" would quietly change what the existing streak
-- counts. This is a separate per-day counter, same (user_id, date) grain
-- as activity_log, tracking the quest's own four stages.
CREATE TABLE IF NOT EXISTS public.daily_quest_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  words_saved integer NOT NULL DEFAULT 0,
  celebrated_at timestamptz,
  reviewed_at timestamptz,
  built_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

ALTER TABLE public.daily_quest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own quest progress"
  ON public.daily_quest_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quest progress"
  ON public.daily_quest_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quest progress"
  ON public.daily_quest_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS daily_quest_progress_user_date_idx
  ON public.daily_quest_progress (user_id, date);

-- Atomic increment so two words saved back-to-back (common while watching a
-- video) can't race a read-then-write and undercount.
CREATE OR REPLACE FUNCTION public.increment_words_saved_today(p_user_id uuid)
RETURNS integer AS $$
DECLARE
  v_words_saved integer;
BEGIN
  INSERT INTO public.daily_quest_progress (user_id, date, words_saved)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, date) DO UPDATE
    SET words_saved = public.daily_quest_progress.words_saved + 1
  RETURNING words_saved INTO v_words_saved;

  RETURN v_words_saved;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.increment_words_saved_today(uuid) TO authenticated;
