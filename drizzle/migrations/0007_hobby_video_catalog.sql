CREATE TABLE public.hobby_video_catalog (
  language text NOT NULL,
  hobby text NOT NULL,
  video_id text NOT NULL,
  title text NOT NULL,
  channel text NOT NULL DEFAULT '',
  thumbnail_url text,
  duration_seconds integer NOT NULL CHECK (duration_seconds > 0 AND duration_seconds <= 1200),
  view_count bigint NOT NULL DEFAULT 0,
  like_count bigint,
  audio_language text NOT NULL,
  stats_checked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (language, hobby, video_id)
);
GRANT SELECT ON public.hobby_video_catalog TO anon, authenticated;
GRANT ALL ON public.hobby_video_catalog TO service_role;
ALTER TABLE public.hobby_video_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public hobby video metadata" ON public.hobby_video_catalog FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX hobby_video_catalog_lookup ON public.hobby_video_catalog(language,hobby);