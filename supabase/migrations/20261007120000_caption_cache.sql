-- Shared caption cache: a video's subtitles are downloaded once and reused by
-- every learner, so the paid caption provider (Supadata) is only hit the first
-- time anyone opens that video in that language.
CREATE TABLE IF NOT EXISTS public.caption_cache (
  video_id TEXT NOT NULL,
  language TEXT NOT NULL,
  subtitles JSONB NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (video_id, language)
);

-- One row per (user, video) that needed a paid Supadata download, used to cap
-- paid downloads per learner and for the whole app each day.
CREATE TABLE IF NOT EXISTS public.caption_fetch_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  video_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS caption_fetch_log_created_idx ON public.caption_fetch_log (created_at);
CREATE INDEX IF NOT EXISTS caption_fetch_log_user_idx ON public.caption_fetch_log (user_id, created_at);

-- Only the fetch-captions edge function (service role) reads or writes these.
ALTER TABLE public.caption_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caption_fetch_log ENABLE ROW LEVEL SECURITY;
