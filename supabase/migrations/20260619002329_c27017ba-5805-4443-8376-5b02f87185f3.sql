
CREATE TABLE public.comprehension_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL,
  language TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  green_count INT NOT NULL DEFAULT 0,
  orange_count INT NOT NULL DEFAULT 0,
  red_count INT NOT NULL DEFAULT 0,
  total_words INT NOT NULL DEFAULT 0,
  unique_words INT NOT NULL DEFAULT 0,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX comprehension_snapshots_user_video_idx
  ON public.comprehension_snapshots (user_id, video_id, created_at DESC);
CREATE INDEX comprehension_snapshots_user_lang_idx
  ON public.comprehension_snapshots (user_id, language, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comprehension_snapshots TO authenticated;
GRANT ALL ON public.comprehension_snapshots TO service_role;

ALTER TABLE public.comprehension_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own comprehension snapshots"
  ON public.comprehension_snapshots
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
