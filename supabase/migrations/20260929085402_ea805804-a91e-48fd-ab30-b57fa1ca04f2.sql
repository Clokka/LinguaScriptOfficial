CREATE TABLE IF NOT EXISTS public.user_interest_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interest_id TEXT NOT NULL,
  language TEXT NOT NULL,
  picks INTEGER NOT NULL DEFAULT 0,
  last_picked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, interest_id, language)
);
GRANT SELECT ON public.user_interest_signals TO authenticated;
GRANT ALL ON public.user_interest_signals TO service_role;
ALTER TABLE public.user_interest_signals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own interest signals" ON public.user_interest_signals;
CREATE POLICY "Users read own interest signals" ON public.user_interest_signals
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_feed_event(_interest_id text, _language text, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _interest_id IS NULL OR _language IS NULL OR length(_interest_id) > 40 THEN RETURN; END IF;
  w := CASE _kind WHEN 'open' THEN 1 WHEN 'half' THEN 2 WHEN 'complete' THEN 3 WHEN 'save' THEN 2 ELSE 0 END;
  IF w = 0 THEN RETURN; END IF;
  INSERT INTO public.user_interest_signals (user_id, interest_id, language, picks, last_picked_at)
  VALUES (auth.uid(), _interest_id, lower(_language), w, now())
  ON CONFLICT (user_id, interest_id, language)
  DO UPDATE SET picks = public.user_interest_signals.picks + w, last_picked_at = now(), updated_at = now();
END; $$;
REVOKE ALL ON FUNCTION public.record_feed_event(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_feed_event(text,text,text) TO authenticated;