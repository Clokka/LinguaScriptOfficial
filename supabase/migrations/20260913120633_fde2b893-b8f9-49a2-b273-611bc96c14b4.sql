-- Real Stripe plan config, shared across every visitor's browser.
--
-- The previous "Stripe fallback" mechanism (src/lib/stripeFallback.ts) stored
-- price IDs and display strings in the ADMIN'S OWN localStorage — meaning
-- only the admin's own browser ever saw configured plans; every other
-- visitor's /pricing page always rendered "no plans available" because
-- their browser never had that localStorage key set. Moving this into a
-- real table makes the prices an admin configures actually visible to
-- every user, which is the entire point of a paywall.
CREATE TABLE IF NOT EXISTS public.payment_plans (
  plan_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  price_display TEXT NOT NULL,
  price_id TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;

-- Signed-out visitors need to see enabled plans too (a paywall a logged-out
-- browser can't even render is not a paywall) — has_role(auth.uid(),'admin')
-- simply evaluates false for an anonymous auth.uid() of NULL, so this stays
-- safe while additionally letting admins preview disabled/draft plans.
DROP POLICY IF EXISTS "Anyone can view enabled payment plans" ON public.payment_plans;
CREATE POLICY "Anyone can view enabled payment plans" ON public.payment_plans
  FOR SELECT
  USING (enabled = true OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage payment plans" ON public.payment_plans;
CREATE POLICY "Admins manage payment plans" ON public.payment_plans
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.payment_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.payment_plans TO authenticated;
GRANT ALL ON public.payment_plans TO service_role;

-- Seed the same three plan slots the old localStorage config had, still
-- disabled with empty price IDs — an admin must paste in their own real
-- Stripe Price IDs before any plan actually appears on /pricing. Real
-- dollar amounts are a business decision this migration can't make up.
INSERT INTO public.payment_plans (plan_key, label, price_display, price_id, enabled, sort_order) VALUES
  ('monthly', 'Monthly', '$9.99 / month', '', false, 1),
  ('yearly', 'Yearly', '$79.99 / year', '', false, 2),
  ('lifetime', 'Lifetime', '$199 one-time', '', false, 3)
ON CONFLICT (plan_key) DO NOTHING;