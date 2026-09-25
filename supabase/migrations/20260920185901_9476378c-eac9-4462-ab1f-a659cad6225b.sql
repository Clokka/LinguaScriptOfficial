CREATE TABLE IF NOT EXISTS public.youtube_search_cache (
  cache_key text PRIMARY KEY,
  language text,
  query text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  hit_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.youtube_search_cache TO service_role;

ALTER TABLE public.youtube_search_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view search cache"
ON public.youtube_search_cache
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.youtube_search_cache TO authenticated;

CREATE INDEX IF NOT EXISTS youtube_search_cache_updated_idx ON public.youtube_search_cache (updated_at DESC);