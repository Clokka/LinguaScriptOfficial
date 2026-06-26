
-- 1. Extend films with discovery metadata
ALTER TABLE public.films
  ADD COLUMN IF NOT EXISTS cefr_level TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Extend video_comprehension with running stats
ALTER TABLE public.video_comprehension
  ADD COLUMN IF NOT EXISTS watch_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_score NUMERIC(5,2);

-- 3. Per-watch session log (scales to millions)
CREATE TABLE IF NOT EXISTS public.watch_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  film_id UUID NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  language TEXT NOT NULL,
  watch_number INTEGER NOT NULL,
  comprehension_pct NUMERIC(5,2) NOT NULL,
  prev_comprehension_pct NUMERIC(5,2),
  delta NUMERIC(5,2) NOT NULL DEFAULT 0,
  green_count INTEGER NOT NULL DEFAULT 0,
  orange_count INTEGER NOT NULL DEFAULT 0,
  red_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_watched_seconds INTEGER NOT NULL DEFAULT 0,
  completion_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
  watched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_sessions TO authenticated;
GRANT ALL ON public.watch_sessions TO service_role;

ALTER TABLE public.watch_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_select_own" ON public.watch_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ws_insert_own" ON public.watch_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ws_update_own" ON public.watch_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ws_delete_own" ON public.watch_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS watch_sessions_user_watched_idx ON public.watch_sessions(user_id, watched_at DESC);
CREATE INDEX IF NOT EXISTS watch_sessions_user_film_idx ON public.watch_sessions(user_id, film_id, watch_number);

-- 4. RPC: record a watch session, updating video_comprehension aggregates atomically.
CREATE OR REPLACE FUNCTION public.record_watch_session(
  _film_id UUID,
  _language TEXT,
  _comprehension NUMERIC,
  _green INTEGER,
  _orange INTEGER,
  _red INTEGER,
  _total_tokens INTEGER,
  _duration_seconds INTEGER DEFAULT 0,
  _completion_pct NUMERIC DEFAULT 0
)
RETURNS TABLE(watch_number INTEGER, prev_pct NUMERIC, new_pct NUMERIC, delta NUMERIC, first_pct NUMERIC, best_pct NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  vc public.video_comprehension%ROWTYPE;
  wnum INTEGER;
  prev NUMERIC;
  delta_v NUMERIC;
  first_v NUMERIC;
  best_v NUMERIC;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO vc FROM public.video_comprehension
    WHERE user_id = uid AND content_type = 'film' AND content_id = _film_id;

  IF NOT FOUND THEN
    INSERT INTO public.video_comprehension
      (user_id, content_type, content_id, language, first_score, latest_score,
       green_count, orange_count, red_count, total_tokens,
       first_watched_at, last_watched_at, watch_count, total_minutes, best_score)
    VALUES
      (uid, 'film', _film_id, _language, _comprehension, _comprehension,
       _green, _orange, _red, _total_tokens, now(), now(),
       1, GREATEST(0, _duration_seconds / 60), _comprehension)
    RETURNING * INTO vc;
    wnum := 1;
    prev := NULL;
    first_v := _comprehension;
    best_v := _comprehension;
  ELSE
    wnum := COALESCE(vc.watch_count, 0) + 1;
    prev := vc.latest_score;
    first_v := vc.first_score;
    best_v := GREATEST(COALESCE(vc.best_score, vc.latest_score), _comprehension);
    UPDATE public.video_comprehension
      SET latest_score = _comprehension,
          green_count = _green,
          orange_count = _orange,
          red_count = _red,
          total_tokens = _total_tokens,
          last_watched_at = now(),
          watch_count = wnum,
          total_minutes = COALESCE(total_minutes,0) + GREATEST(0, _duration_seconds / 60),
          best_score = best_v
      WHERE id = vc.id;
  END IF;

  delta_v := _comprehension - COALESCE(prev, _comprehension);

  INSERT INTO public.watch_sessions
    (user_id, film_id, language, watch_number, comprehension_pct, prev_comprehension_pct,
     delta, green_count, orange_count, red_count, total_tokens,
     duration_watched_seconds, completion_pct)
  VALUES
    (uid, _film_id, _language, wnum, _comprehension, prev,
     delta_v, _green, _orange, _red, _total_tokens,
     COALESCE(_duration_seconds, 0), COALESCE(_completion_pct, 0));

  RETURN QUERY SELECT wnum, prev, _comprehension, delta_v, first_v, best_v;
END;
$$;

-- 5. RPC: aggregate dashboard stats
CREATE OR REPLACE FUNCTION public.user_progress_stats()
RETURNS TABLE(
  avg_comprehension NUMERIC,
  highest_comprehension NUMERIC,
  avg_gain_per_watch NUMERIC,
  videos_mastered INTEGER,
  videos_in_progress INTEGER,
  total_minutes INTEGER,
  vocab_learned INTEGER
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN QUERY
  SELECT
    COALESCE(ROUND(AVG(vc.latest_score)::numeric, 1), 0)::numeric,
    COALESCE(MAX(vc.latest_score), 0)::numeric,
    COALESCE(ROUND(AVG(NULLIF(vc.latest_score - vc.first_score, 0))::numeric, 1), 0)::numeric,
    COALESCE(SUM(CASE WHEN vc.latest_score >= 90 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(CASE WHEN vc.latest_score < 90 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(SUM(vc.total_minutes), 0)::int,
    (SELECT COUNT(*)::int FROM public.saved_words WHERE user_id = uid AND state = 'green')
  FROM public.video_comprehension vc
  WHERE vc.user_id = uid;
END;
$$;

-- 6. RPC: 7-day learning rate per language
CREATE OR REPLACE FUNCTION public.user_learning_rate(_language TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rate NUMERIC;
BEGIN
  IF uid IS NULL THEN RETURN 0; END IF;
  SELECT COALESCE(ROUND(AVG(delta)::numeric, 1), 0)
    INTO rate
    FROM public.watch_sessions
   WHERE user_id = uid
     AND language = _language
     AND watched_at > now() - INTERVAL '7 days'
     AND delta IS NOT NULL;
  RETURN COALESCE(rate, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_watch_session(UUID, TEXT, NUMERIC, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_progress_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_learning_rate(TEXT) TO authenticated;
