-- Security fixes from the October 2026 pre-launch audit.
-- Each section explains what was wrong and what changes.

-- =========================================================
-- 1. Pro only from LIVE subscriptions
-- =========================================================
-- The browser picks "sandbox" or "live" when it starts a checkout, and the
-- webhook stored sandbox subscriptions too. This trigger then granted real
-- Pro for them, so anyone could subscribe with Stripe's public test card and
-- get Pro free. Sandbox rows are still stored (handy for testing billing
-- screens) but no longer touch profiles.
CREATE OR REPLACE FUNCTION public.sync_pro_from_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_paid BOOLEAN;
BEGIN
  IF NEW.environment IS DISTINCT FROM 'live' THEN
    RETURN NEW;
  END IF;

  is_paid := NEW.status IN ('active', 'trialing', 'past_due')
             AND (NEW.current_period_end IS NULL OR NEW.current_period_end > now());

  IF is_paid THEN
    UPDATE public.profiles
       SET is_pro = true,
           pro_source = 'subscription',
           pro_expires_at = NEW.current_period_end
     WHERE user_id = NEW.user_id;
  ELSIF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    -- Only revoke if Pro came from a subscription (preserve admin grants)
    UPDATE public.profiles
       SET is_pro = false,
           pro_source = 'none',
           pro_expires_at = NULL
     WHERE user_id = NEW.user_id
       AND pro_source = 'subscription';
  END IF;
  RETURN NEW;
END;
$$;

-- =========================================================
-- 2. Early-access email list: no longer readable by everyone
-- =========================================================
-- Anyone holding the site's public key could download every signup address.
-- Visitors can still sign up; only admins can read the list (/admin).
DROP POLICY IF EXISTS "Anyone can view email signups" ON public.email_signups;
DROP POLICY IF EXISTS "Admins can view email signups" ON public.email_signups;
CREATE POLICY "Admins can view email signups" ON public.email_signups
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 3. Shared subtitle cache: signed-in users only
-- =========================================================
-- Logged-out visitors could add or delete any film's subtitles. The Watch
-- page still writes this shared cache for signed-in learners, so writes stay
-- open to them for now; moving the cache into a server function would let us
-- lock it down completely.
DROP POLICY IF EXISTS "Anyone can insert subtitles" ON public.subtitles;
DROP POLICY IF EXISTS "Anyone can delete subtitles" ON public.subtitles;
DROP POLICY IF EXISTS "Signed-in users can insert subtitles" ON public.subtitles;
DROP POLICY IF EXISTS "Signed-in users can delete subtitles" ON public.subtitles;
CREATE POLICY "Signed-in users can insert subtitles" ON public.subtitles
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Signed-in users can delete subtitles" ON public.subtitles
  FOR DELETE TO authenticated USING (true);

-- =========================================================
-- 4. Gift links: no public list of tokens, claims can't double up
-- =========================================================
-- "Anyone can view unclaimed links" let anybody list every token and claim
-- other people's gifts. The /gift page uses get_gift_link_preview and
-- claim_gift_link (both SECURITY DEFINER), so it doesn't need this.
DROP POLICY IF EXISTS "Anyone can view unclaimed links" ON pet_gift_links;
DROP POLICY IF EXISTS "Admins view all gift links" ON pet_gift_links;
CREATE POLICY "Admins view all gift links" ON pet_gift_links
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Same function as 20260805120000_gift_accessories.sql, with one change:
-- the link row is locked (FOR UPDATE) while it's checked and claimed, so two
-- people opening the same link at the same moment can't both get the pet.
CREATE OR REPLACE FUNCTION claim_gift_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimer_id uuid := auth.uid();
  v_link pet_gift_links%ROWTYPE;
  v_accessory text;
  v_slot text;
BEGIN
  IF v_claimer_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_link
  FROM pet_gift_links
  WHERE token = p_token
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link not found');
  END IF;

  IF v_link.claimed_by IS NOT NULL THEN
    RETURN json_build_object('error', 'This gift has already been claimed');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN json_build_object('error', 'This gift link has expired');
  END IF;

  IF v_link.sender_id = v_claimer_id THEN
    RETURN json_build_object('error', 'You cannot claim your own gift');
  END IF;

  INSERT INTO pet_collection (user_id, pet_id, gifted_from)
  VALUES (v_claimer_id, v_link.pet_id, v_link.sender_id)
  ON CONFLICT (user_id, pet_id) DO NOTHING;

  IF v_link.accessories IS NOT NULL THEN
    FOREACH v_accessory IN ARRAY v_link.accessories LOOP
      -- Map accessory id → slot. Keep this in sync with src/lib/accessories.ts.
      v_slot := CASE v_accessory
        WHEN 'sneakers' THEN 'feet'
        WHEN 'trucker_hat' THEN 'head'
        ELSE NULL
      END;
      IF v_slot IS NOT NULL THEN
        INSERT INTO pet_equipment (user_id, pet_id, slot, accessory_id)
        VALUES (v_claimer_id, v_link.pet_id, v_slot, v_accessory)
        ON CONFLICT (user_id, pet_id, slot) DO UPDATE
          SET accessory_id = EXCLUDED.accessory_id, equipped = true;
      END IF;
    END LOOP;
  END IF;

  UPDATE pet_gift_links
  SET claimed_by = v_claimer_id, claimed_at = now()
  WHERE id = v_link.id;

  INSERT INTO pet_gifts (sender_id, recipient_id, pet_id)
  VALUES (v_link.sender_id, v_claimer_id, v_link.pet_id)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'pet_id', v_link.pet_id,
    'accessories', COALESCE(v_link.accessories, ARRAY[]::text[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION claim_gift_link(text) TO authenticated;

-- =========================================================
-- 5. Terms acceptance record (Stripe checklist)
-- =========================================================
-- One row each time a learner ticks "I agree" before paying: who, which
-- version of the Terms, and when.
CREATE TABLE IF NOT EXISTS public.terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  context text NOT NULL DEFAULT 'checkout',
  accepted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS terms_acceptances_user_idx ON public.terms_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users record their own acceptance" ON public.terms_acceptances;
CREATE POLICY "Users record their own acceptance" ON public.terms_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view their own acceptances" ON public.terms_acceptances;
CREATE POLICY "Users view their own acceptances" ON public.terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT ON public.terms_acceptances TO authenticated;
GRANT ALL ON public.terms_acceptances TO service_role;

-- =========================================================
-- 6. Daily caps for paid AI / translation functions
-- =========================================================
-- Those functions could be called with the site's public key as often as
-- anyone liked, each call costing AI credits. Each function now counts calls
-- per signed-in user (or per hashed IP for guests) per day. The check and the
-- +1 happen in one statement, so parallel requests can't sneak past the cap.
CREATE TABLE IF NOT EXISTS public.function_usage (
  caller_key text NOT NULL,          -- 'u:<user id>' or 'ip:<sha256 of IP>'
  function_name text NOT NULL,
  day date NOT NULL DEFAULT current_date,
  calls integer NOT NULL DEFAULT 0,
  PRIMARY KEY (caller_key, function_name, day)
);

-- Only edge functions (service role) touch this table.
ALTER TABLE public.function_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.function_usage FROM anon, authenticated;
GRANT ALL ON public.function_usage TO service_role;

CREATE OR REPLACE FUNCTION public.bump_function_usage(
  _caller_key text, _function_name text, _daily_cap integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calls integer;
BEGIN
  INSERT INTO public.function_usage AS fu (caller_key, function_name, day, calls)
  VALUES (_caller_key, _function_name, current_date, 1)
  ON CONFLICT (caller_key, function_name, day)
    DO UPDATE SET calls = fu.calls + 1
    WHERE fu.calls < _daily_cap
  RETURNING calls INTO v_calls;

  -- No row returned means the existing row was already at the cap.
  RETURN v_calls IS NOT NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.bump_function_usage(text, text, integer) FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.bump_function_usage(text, text, integer) TO service_role;

-- Old counters are useless after a day or two.
CREATE OR REPLACE FUNCTION public.purge_old_function_usage()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.function_usage WHERE day < current_date - 2;
$$;
REVOKE EXECUTE ON FUNCTION public.purge_old_function_usage() FROM anon, authenticated, public;

-- Nightly, next to purge-stale-data (20261018120000_purge_stale_data.sql).
DO $$ BEGIN PERFORM cron.unschedule('purge-function-usage'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('purge-function-usage', '29 3 * * *', $$SELECT public.purge_old_function_usage();$$);

NOTIFY pgrst, 'reload schema';
