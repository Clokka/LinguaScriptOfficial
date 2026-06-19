
-- profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS watch_progress JSONB NOT NULL DEFAULT '{}'::jsonb;

-- films
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS difficulty SMALLINT,
  ADD COLUMN IF NOT EXISTS category TEXT;

-- watch_history
CREATE TABLE IF NOT EXISTS public.watch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  film_id UUID REFERENCES public.films(id) ON DELETE SET NULL,
  video_id TEXT NOT NULL,
  title TEXT,
  thumbnail_url TEXT,
  language TEXT,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_history TO authenticated;
GRANT ALL ON public.watch_history TO service_role;

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watch_history_select_own"
  ON public.watch_history FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "watch_history_insert_own"
  ON public.watch_history FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_history_update_own"
  ON public.watch_history FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watch_history_delete_own"
  ON public.watch_history FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS watch_history_user_watched_idx
  ON public.watch_history (user_id, watched_at DESC);

CREATE TRIGGER watch_history_set_updated_at
  BEFORE UPDATE ON public.watch_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
