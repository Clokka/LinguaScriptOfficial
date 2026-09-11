-- "Connect YouTube" + auto-subscribe to target-language channels.
--
-- Reuses the SAME Google OAuth client already configured for Google
-- sign-in (Supabase Authentication -> Providers -> Google) rather than a
-- second OAuth client — signInWithOAuth is called again with an extra
-- `youtube.force-ssl` scope, and Supabase hands back a provider access
-- token + refresh token on that specific round trip, which the app then
-- persists here (Supabase itself does not persist provider tokens across
-- normal session refreshes, so this table is the only place they live).

-- Raw OAuth tokens. Deliberately NOT selectable/writable by the
-- authenticated role at all — no RLS policy is granted for authenticated,
-- so the default-deny leaves this service_role-only. A user's own access
-- token must never be readable from the browser; every read/write goes
-- through youtube-store-connection / youtube-subscribe, both of which use
-- the service role key server-side.
CREATE TABLE IF NOT EXISTS public.youtube_connections (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  scope TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.youtube_connections TO service_role;
ALTER TABLE public.youtube_connections ENABLE ROW LEVEL SECURITY;
-- No policies for `authenticated` — intentional default-deny.

-- What a user actually got subscribed to — safe to show them, unlike the
-- token table above.
CREATE TABLE IF NOT EXISTS public.youtube_subscribed_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  source TEXT NOT NULL CHECK (source IN ('core', 'niche')),
  interest_id TEXT,
  language TEXT NOT NULL,
  language_verified BOOLEAN NOT NULL DEFAULT false,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

GRANT SELECT ON public.youtube_subscribed_channels TO authenticated;
GRANT ALL ON public.youtube_subscribed_channels TO service_role;
ALTER TABLE public.youtube_subscribed_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own subscribed channels"
  ON public.youtube_subscribed_channels FOR SELECT
  USING (auth.uid() = user_id);

-- Resolving "Dreaming Spanish" -> a real channel ID, or "German cars" ->
-- the best-matching channel, costs real YouTube API quota (search.list is
-- 100 units). With a 10,000-unit/day default project quota, re-resolving
-- the same name/niche+language pair for every single user would cap this
-- feature at a handful of users a day. Caching the resolution means only
-- the FIRST user to ever request a given (name-or-niche, language) pair
-- pays that cost — everyone after just pays the 50-unit subscribe call.
-- Internal cache: no client access at all, service_role only.
CREATE TABLE IF NOT EXISTS public.youtube_channel_resolution_cache (
  cache_key TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  language_verified BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.youtube_channel_resolution_cache TO service_role;
ALTER TABLE public.youtube_channel_resolution_cache ENABLE ROW LEVEL SECURITY;
-- No policies for `authenticated` — service_role only, same reasoning as
-- youtube_connections.

CREATE OR REPLACE FUNCTION public.youtube_connection_status()
RETURNS TABLE(connected boolean, connected_at timestamptz, channel_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT
    EXISTS(SELECT 1 FROM public.youtube_connections yc WHERE yc.user_id = auth.uid()),
    (SELECT yc.connected_at FROM public.youtube_connections yc WHERE yc.user_id = auth.uid()),
    (SELECT count(*)::integer FROM public.youtube_subscribed_channels sc WHERE sc.user_id = auth.uid());
END;
$function$;
