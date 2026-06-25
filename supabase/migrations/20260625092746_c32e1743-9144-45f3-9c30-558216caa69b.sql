-- Per-video comprehension tracking. Works for both admin films and user-pasted lessons.
CREATE TABLE public.video_comprehension (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('film','lesson')),
  content_id uuid NOT NULL,
  language text NOT NULL,
  first_score numeric(5,2) NOT NULL,
  latest_score numeric(5,2) NOT NULL,
  green_count integer NOT NULL DEFAULT 0,
  orange_count integer NOT NULL DEFAULT 0,
  red_count integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  first_watched_at timestamptz NOT NULL DEFAULT now(),
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, content_type, content_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_comprehension TO authenticated;
GRANT ALL ON public.video_comprehension TO service_role;

ALTER TABLE public.video_comprehension ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vc_select_own" ON public.video_comprehension
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "vc_insert_own" ON public.video_comprehension
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vc_update_own" ON public.video_comprehension
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vc_delete_own" ON public.video_comprehension
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER video_comprehension_updated_at
  BEFORE UPDATE ON public.video_comprehension
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX video_comprehension_user_delta_idx
  ON public.video_comprehension (user_id, (latest_score - first_score) DESC);