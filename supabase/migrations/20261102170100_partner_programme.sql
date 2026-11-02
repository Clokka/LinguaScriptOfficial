-- Partner programme, part 2: LinguaScript's own affiliate system (replaces GoAffPro).
--
-- Flow: /r/:code link → record_referral_click → visitor signs up →
-- claim_referral (new accounts only) → payments-webhook writes a pending
-- commission on each paid invoice → approved after 30 days without refund →
-- paid out monthly (admin_mark_commissions_paid).
--
-- Privacy: partners never read rows directly. They call partner_dashboard(),
-- which returns totals for THEIR partner id only and folds any breakdown
-- group smaller than 5 people into "Other", so no single learner can be
-- picked out. No emails, names or user ids ever leave these functions.

-- ── Tables ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  code text UNIQUE NOT NULL CHECK (code ~ '^[a-z0-9][a-z0-9_-]{1,30}$'),
  display_name text NOT NULL DEFAULT '',
  socials jsonb NOT NULL DEFAULT '{}'::jsonb,
  brand_logo_url text,
  logo_approved boolean NOT NULL DEFAULT false,
  commission_rate numeric(4,3) NOT NULL DEFAULT 0.25 CHECK (commission_rate >= 0 AND commission_rate <= 0.6),
  commission_months int NOT NULL DEFAULT 12 CHECK (commission_months BETWEEN 1 AND 60),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','paused')),
  payout_details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.referral_clicks (
  id bigserial PRIMARY KEY,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'other',
  landing_path text,
  visitor_hash text,
  region text,
  device text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_clicks_partner_time ON public.referral_clicks (partner_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.referrals (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'other',
  signed_up_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referrals_partner_time ON public.referrals (partner_id, signed_up_at DESC);

CREATE TABLE IF NOT EXISTS public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stripe_ref text UNIQUE NOT NULL,          -- invoice id or checkout session id
  stripe_payment_intent text,
  gross_amount int NOT NULL,                -- minor units, excluding tax
  commission_amount int NOT NULL,           -- minor units
  currency text NOT NULL DEFAULT 'gbp',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','reversed')),
  available_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commissions_partner ON public.commissions (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS commissions_pi ON public.commissions (stripe_payment_intent);

CREATE TABLE IF NOT EXISTS public.payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount int NOT NULL,
  currency text NOT NULL DEFAULT 'gbp',
  method text NOT NULL DEFAULT 'bank_transfer',
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Helpers ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_growth_team(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin') OR public.has_role(_uid, 'marketer');
$$;

-- ── Row level security: writes only through functions / service role ───
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Team reads partners" ON public.partners;
CREATE POLICY "Team reads partners" ON public.partners FOR SELECT TO authenticated
  USING (public.is_growth_team(auth.uid()) OR user_id = auth.uid());
DROP POLICY IF EXISTS "Team reads clicks" ON public.referral_clicks;
CREATE POLICY "Team reads clicks" ON public.referral_clicks FOR SELECT TO authenticated
  USING (public.is_growth_team(auth.uid()));
DROP POLICY IF EXISTS "Team reads referrals" ON public.referrals;
CREATE POLICY "Team reads referrals" ON public.referrals FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Partner reads own commissions" ON public.commissions;
CREATE POLICY "Partner reads own commissions" ON public.commissions FOR SELECT TO authenticated
  USING (public.is_growth_team(auth.uid())
         OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Partner reads own payouts" ON public.payouts;
CREATE POLICY "Partner reads own payouts" ON public.payouts FOR SELECT TO authenticated
  USING (public.is_growth_team(auth.uid())
         OR partner_id IN (SELECT id FROM public.partners WHERE user_id = auth.uid()));

-- payout_details (bank/PayPal) is left out on purpose: only admins read it, through admin_partner_payout_details().
REVOKE SELECT ON public.partners FROM authenticated;
GRANT SELECT (id, user_id, code, display_name, socials, brand_logo_url, logo_approved, commission_rate, commission_months, status, created_at)
  ON public.partners TO authenticated;
GRANT SELECT ON public.referral_clicks, public.referrals, public.commissions, public.payouts TO authenticated;
GRANT ALL ON public.partners, public.referral_clicks, public.referrals, public.commissions, public.payouts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.referral_clicks_id_seq TO service_role;

-- ── Public: a link was clicked ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_referral_click(
  _code text, _channel text DEFAULT 'other', _path text DEFAULT '/',
  _visitor text DEFAULT NULL, _region text DEFAULT NULL, _device text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid;
BEGIN
  SELECT id INTO _pid FROM partners WHERE code = lower(_code) AND status = 'active';
  IF _pid IS NULL THEN RETURN false; END IF;
  -- One click per visitor per partner per 30 minutes (stops refresh spam).
  IF _visitor IS NOT NULL AND EXISTS (
    SELECT 1 FROM referral_clicks WHERE partner_id = _pid AND visitor_hash = left(_visitor, 64)
      AND created_at > now() - interval '30 minutes') THEN
    RETURN true;
  END IF;
  INSERT INTO referral_clicks (partner_id, channel, landing_path, visitor_hash, region, device)
  VALUES (_pid, left(coalesce(nullif(lower(_channel), ''), 'other'), 20), left(_path, 120),
          left(_visitor, 64), left(_region, 30), left(_device, 10));
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.record_referral_click(text, text, text, text, text, text) TO anon, authenticated;

-- ── Signed-in: credit my new account to a partner ───────────────────────
CREATE OR REPLACE FUNCTION public.claim_referral(_code text, _channel text DEFAULT 'other')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _pid uuid; _owner uuid; _created timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT id, user_id INTO _pid, _owner FROM partners WHERE code = lower(_code) AND status = 'active';
  IF _pid IS NULL OR _owner = auth.uid() THEN RETURN false; END IF;      -- no self-referrals
  SELECT created_at INTO _created FROM auth.users WHERE id = auth.uid();
  IF _created < now() - interval '3 days' THEN RETURN false; END IF;     -- new accounts only
  INSERT INTO referrals (user_id, partner_id, channel)
  VALUES (auth.uid(), _pid, left(coalesce(nullif(lower(_channel), ''), 'other'), 20))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.claim_referral(text, text) TO authenticated;

-- ── Partner / team: the dashboard numbers (totals only) ─────────────────
CREATE OR REPLACE FUNCTION public.partner_dashboard(_partner_id uuid DEFAULT NULL, _days int DEFAULT 30)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _p partners; _since timestamptz := now() - make_interval(days => greatest(1, least(_days, 365)));
  _res jsonb;
BEGIN
  IF _partner_id IS NOT NULL AND public.is_growth_team(auth.uid()) THEN
    SELECT * INTO _p FROM partners WHERE id = _partner_id;
  ELSE
    SELECT * INTO _p FROM partners WHERE user_id = auth.uid();
  END IF;
  IF _p.id IS NULL THEN RETURN NULL; END IF;

  WITH clk AS (SELECT * FROM referral_clicks WHERE partner_id = _p.id AND created_at >= _since),
       refs AS (SELECT * FROM referrals WHERE partner_id = _p.id AND signed_up_at >= _since),
       act AS (SELECT r.user_id FROM refs r
               WHERE (SELECT count(*) FROM saved_words s WHERE s.user_id = r.user_id) >= 10),
       paid AS (SELECT DISTINCT user_id FROM commissions
                WHERE partner_id = _p.id AND status <> 'reversed' AND user_id IN (SELECT user_id FROM refs)),
       ch AS (SELECT channel, count(*) n FROM clk GROUP BY channel),
       chs AS (SELECT channel, count(*) n FROM refs GROUP BY channel),
       dev AS (SELECT coalesce(device, 'unknown') d, count(*) n FROM clk GROUP BY 1),
       reg AS (SELECT coalesce(region, 'unknown') r, count(*) n FROM clk GROUP BY 1),
       money AS (SELECT status, sum(commission_amount) amt FROM commissions WHERE partner_id = _p.id GROUP BY status),
       months AS (SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') m,
                         sum(commission_amount) FILTER (WHERE status <> 'reversed') earned,
                         count(*) FILTER (WHERE status <> 'reversed') sales
                  FROM commissions WHERE partner_id = _p.id GROUP BY 1 ORDER BY 1 DESC LIMIT 12)
  SELECT jsonb_build_object(
    'partner', jsonb_build_object('id', _p.id, 'code', _p.code, 'display_name', _p.display_name,
       'socials', _p.socials, 'brand_logo_url', _p.brand_logo_url, 'logo_approved', _p.logo_approved,
       'commission_rate', _p.commission_rate, 'commission_months', _p.commission_months, 'status', _p.status,
       'has_payout_details', _p.payout_details IS NOT NULL),
    'days', _days,
    'clicks', (SELECT count(*) FROM clk),
    'visitors', (SELECT count(DISTINCT visitor_hash) FROM clk),
    'signups', (SELECT count(*) FROM refs),
    'activated', (SELECT count(*) FROM act),
    'paid', (SELECT count(*) FROM paid),
    -- Breakdowns: groups under 5 are folded into "other" so nobody can be singled out.
    'channels', (SELECT coalesce(jsonb_agg(jsonb_build_object('channel', c, 'clicks', n, 'signups', s) ORDER BY n DESC), '[]'::jsonb)
                 FROM (SELECT CASE WHEN coalesce(ch.n, 0) + coalesce(chs.n, 0) < 5 THEN 'other' ELSE channel END c,
                              sum(coalesce(ch.n, 0)) n, sum(coalesce(chs.n, 0)) s
                       FROM ch FULL JOIN chs USING (channel) GROUP BY 1) x),
    'devices', (SELECT coalesce(jsonb_agg(jsonb_build_object('device', d, 'clicks', n) ORDER BY n DESC), '[]'::jsonb)
                FROM (SELECT CASE WHEN n < 5 THEN 'other' ELSE d END d, sum(n) n FROM dev GROUP BY 1) x),
    'regions', (SELECT coalesce(jsonb_agg(jsonb_build_object('region', r, 'clicks', n) ORDER BY n DESC), '[]'::jsonb)
                FROM (SELECT CASE WHEN n < 5 THEN 'other' ELSE r END r, sum(n) n FROM reg GROUP BY 1) x),
    'earnings', jsonb_build_object(
       'pending', coalesce((SELECT amt FROM money WHERE status = 'pending'), 0),
       'approved', coalesce((SELECT amt FROM money WHERE status = 'approved'), 0),
       'paid', coalesce((SELECT amt FROM money WHERE status = 'paid'), 0),
       'next_available', (SELECT min(available_at) FROM commissions WHERE partner_id = _p.id AND status = 'pending')),
    'months', (SELECT coalesce(jsonb_agg(jsonb_build_object('month', m, 'earned', earned, 'sales', sales)), '[]'::jsonb) FROM months),
    'payouts', (SELECT coalesce(jsonb_agg(jsonb_build_object('date', created_at, 'amount', amount, 'method', method) ORDER BY created_at DESC), '[]'::jsonb)
                FROM payouts WHERE partner_id = _p.id)
  ) INTO _res;
  RETURN _res;
END $$;
GRANT EXECUTE ON FUNCTION public.partner_dashboard(uuid, int) TO authenticated;

-- ── Team: every partner at a glance ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.growth_partners_overview(_days int DEFAULT 30)
RETURNS TABLE (id uuid, code text, display_name text, status text, commission_rate numeric,
               clicks bigint, signups bigint, sales bigint, pending int, approved int, paid int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _since timestamptz := now() - make_interval(days => greatest(1, least(_days, 365)));
BEGIN
  IF NOT public.is_growth_team(auth.uid()) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.code, p.display_name, p.status, p.commission_rate,
    (SELECT count(*) FROM referral_clicks c WHERE c.partner_id = p.id AND c.created_at >= _since),
    (SELECT count(*) FROM referrals r WHERE r.partner_id = p.id AND r.signed_up_at >= _since),
    (SELECT count(*) FROM commissions m WHERE m.partner_id = p.id AND m.status <> 'reversed' AND m.created_at >= _since),
    coalesce((SELECT sum(m.commission_amount)::int FROM commissions m WHERE m.partner_id = p.id AND m.status = 'pending'), 0),
    coalesce((SELECT sum(m.commission_amount)::int FROM commissions m WHERE m.partner_id = p.id AND m.status = 'approved'), 0),
    coalesce((SELECT sum(m.commission_amount)::int FROM commissions m WHERE m.partner_id = p.id AND m.status = 'paid'), 0)
  FROM partners p ORDER BY p.created_at;
END $$;
GRANT EXECUTE ON FUNCTION public.growth_partners_overview(int) TO authenticated;

-- ── Partner: edit my own profile (logo waits for approval) ──────────────
CREATE OR REPLACE FUNCTION public.update_my_partner_profile(
  _display_name text, _socials jsonb, _brand_logo_url text, _payout_details text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE partners SET
    display_name = left(coalesce(_display_name, display_name), 60),
    socials = coalesce(_socials, socials),
    logo_approved = CASE WHEN _brand_logo_url IS DISTINCT FROM brand_logo_url THEN false ELSE logo_approved END,
    brand_logo_url = left(_brand_logo_url, 300),
    payout_details = coalesce(left(_payout_details, 300), payout_details)
  WHERE user_id = auth.uid();
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.update_my_partner_profile(text, jsonb, text, text) TO authenticated;

-- ── Admin only ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_upsert_partner(
  _email text, _code text, _display_name text, _rate numeric DEFAULT 0.25,
  _months int DEFAULT 12, _status text DEFAULT 'active')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid; _pid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'No LinguaScript account uses that email yet. Ask them to sign up first.'; END IF;
  INSERT INTO partners (user_id, code, display_name, commission_rate, commission_months, status)
  VALUES (_uid, lower(trim(_code)), coalesce(_display_name, ''), _rate, _months, _status)
  ON CONFLICT (user_id) DO UPDATE SET code = EXCLUDED.code, display_name = EXCLUDED.display_name,
    commission_rate = EXCLUDED.commission_rate, commission_months = EXCLUDED.commission_months, status = EXCLUDED.status
  RETURNING id INTO _pid;
  INSERT INTO user_roles (user_id, role) VALUES (_uid, 'partner') ON CONFLICT DO NOTHING;
  RETURN _pid;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_upsert_partner(text, text, text, numeric, int, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_team_role(_email text, _role public.app_role, _grant boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  IF _role NOT IN ('marketer', 'partner') THEN RAISE EXCEPTION 'Only marketer or partner can be set here'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'No LinguaScript account uses that email yet. Ask them to sign up first.'; END IF;
  IF _grant THEN
    INSERT INTO user_roles (user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM user_roles WHERE user_id = _uid AND role = _role;
  END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_team_role(text, public.app_role, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_approve_logo(_partner_id uuid, _ok boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  UPDATE partners SET logo_approved = _ok, brand_logo_url = CASE WHEN _ok THEN brand_logo_url ELSE NULL END WHERE id = _partner_id;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_approve_logo(uuid, boolean) TO authenticated;

-- Pending commissions older than their 30-day hold become payable.
CREATE OR REPLACE FUNCTION public.approve_due_commissions()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n int;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  UPDATE commissions SET status = 'approved' WHERE status = 'pending' AND available_at <= now();
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;
GRANT EXECUTE ON FUNCTION public.approve_due_commissions() TO authenticated, service_role;

-- Record a payout: every approved commission for the partner becomes paid.
CREATE OR REPLACE FUNCTION public.admin_mark_commissions_paid(_partner_id uuid, _reference text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _sum int; _cur text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  SELECT coalesce(sum(commission_amount), 0)::int, min(currency) INTO _sum, _cur
    FROM commissions WHERE partner_id = _partner_id AND status = 'approved';
  IF _sum <= 0 THEN RETURN 0; END IF;  -- refunds after payout can leave a negative balance; it rolls into next month
  UPDATE commissions SET status = 'paid' WHERE partner_id = _partner_id AND status = 'approved';
  INSERT INTO payouts (partner_id, amount, currency, reference) VALUES (_partner_id, _sum, coalesce(_cur, 'gbp'), left(_reference, 120));
  RETURN _sum;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_mark_commissions_paid(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_partner_payout_details(_partner_id uuid)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN (SELECT payout_details FROM partners WHERE id = _partner_id);
END $$;
GRANT EXECUTE ON FUNCTION public.admin_partner_payout_details(uuid) TO authenticated;
