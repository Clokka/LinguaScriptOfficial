-- Implicit feedback for the video recommendation rails.
--
-- Onboarding interests are a one-time, static cold-start signal. What a
-- learner actually clicks from an interest rail is a much stronger signal
-- of real taste than a checkbox ticked once during signup — this table
-- lets PersonalizedRails reorder which interests get the top rail slots
-- based on what someone actually watches, not just what they picked once.
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

CREATE POLICY "Users read own interest signals"
  ON public.user_interest_signals FOR SELECT
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE policy: writes only happen through
-- record_interest_pick() below, which is the one place a "pick" is
-- legitimately recorded. A direct table grant would let a client fabricate
-- arbitrary engagement counts for itself with no real corresponding video
-- pick.
CREATE OR REPLACE FUNCTION public.record_interest_pick(_interest_id text, _language text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _interest_id IS NULL OR _language IS NULL THEN RETURN; END IF;

  INSERT INTO public.user_interest_signals (user_id, interest_id, language, picks, last_picked_at)
  VALUES (auth.uid(), _interest_id, lower(_language), 1, now())
  ON CONFLICT (user_id, interest_id, language)
  DO UPDATE SET
    picks = public.user_interest_signals.picks + 1,
    last_picked_at = now(),
    updated_at = now();
END;
$function$;
