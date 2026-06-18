
-- =========================================================
-- 1. ROLES
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own roles" ON public.user_roles;
CREATE POLICY "Users see own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

DROP POLICY IF EXISTS "Admins see all roles" ON public.user_roles;
CREATE POLICY "Admins see all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================================
-- 2. PROFILE COLUMNS for Pro tracking
-- =========================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_source TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_granted_by UUID,
  ADD COLUMN IF NOT EXISTS pro_granted_at TIMESTAMPTZ;

-- =========================================================
-- 3. SUBSCRIPTIONS table (Stripe-backed)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id TEXT NOT NULL UNIQUE,
  stripe_customer_id TEXT NOT NULL,
  product_id TEXT,
  price_id TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  environment TEXT NOT NULL DEFAULT 'sandbox',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_id ON public.subscriptions(stripe_subscription_id);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own subscription" ON public.subscriptions;
CREATE POLICY "Users see own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins see all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins see all subscriptions" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 4. Sync subscription <-> profile.is_pro
-- =========================================================
CREATE OR REPLACE FUNCTION public.sync_pro_from_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_paid BOOLEAN;
BEGIN
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

DROP TRIGGER IF EXISTS trg_sync_pro_from_subscription ON public.subscriptions;
CREATE TRIGGER trg_sync_pro_from_subscription
  AFTER INSERT OR UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_pro_from_subscription();

-- =========================================================
-- 5. ADMIN: grant / revoke / search / list
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_grant_pro(_user_id UUID, _days INT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'missing_user'; END IF;

  UPDATE public.profiles
     SET is_pro = true,
         pro_source = 'admin_grant',
         pro_granted_by = auth.uid(),
         pro_granted_at = now(),
         pro_expires_at = CASE WHEN _days IS NULL THEN NULL ELSE now() + make_interval(days => _days) END
   WHERE user_id = _user_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_pro(_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  UPDATE public.profiles
     SET is_pro = false,
         pro_source = 'none',
         pro_expires_at = NULL,
         pro_granted_by = NULL,
         pro_granted_at = NULL
   WHERE user_id = _user_id
     AND pro_source = 'admin_grant';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_users(_q TEXT)
RETURNS TABLE(user_id UUID, email TEXT, display_name TEXT, username TEXT, is_pro BOOLEAN, pro_source TEXT, pro_expires_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY
    SELECT p.user_id,
           u.email::TEXT,
           p.display_name,
           p.username,
           COALESCE(p.is_pro, false),
           COALESCE(p.pro_source, 'none'),
           p.pro_expires_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.user_id
     WHERE _q IS NOT NULL AND length(trim(_q)) > 0
       AND (
         u.email ILIKE '%' || _q || '%'
         OR p.username ILIKE '%' || _q || '%'
         OR p.display_name ILIKE '%' || _q || '%'
       )
     ORDER BY p.created_at DESC
     LIMIT 25;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_pro_users()
RETURNS TABLE(user_id UUID, email TEXT, display_name TEXT, username TEXT, pro_source TEXT, pro_expires_at TIMESTAMPTZ, pro_granted_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY
    SELECT p.user_id,
           u.email::TEXT,
           p.display_name,
           p.username,
           COALESCE(p.pro_source, 'none'),
           p.pro_expires_at,
           p.pro_granted_at
      FROM public.profiles p
      LEFT JOIN auth.users u ON u.id = p.user_id
     WHERE COALESCE(p.is_pro, false) = true
     ORDER BY p.pro_granted_at DESC NULLS LAST, p.created_at DESC;
END;
$$;

-- =========================================================
-- 6. Seed admin role for the project owner
--    (anyone whose email is in this list becomes an admin on first run;
--     additional admins can be added later by an existing admin)
-- =========================================================
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
  FROM auth.users
 WHERE email IN ('rowanawesome1@gmail.com', 'rowanawesome2@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
