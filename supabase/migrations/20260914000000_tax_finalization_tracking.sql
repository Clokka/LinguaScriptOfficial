-- Stripe Tax was just enabled on Checkout Sessions (automatic_tax: true).
-- A subscription's renewal invoices are generated automatically outside the
-- checkout flow — if a customer's saved address ever becomes insufficient
-- for tax calculation, Stripe can't finalize that invoice and can't collect
-- payment. Left unhandled, the subscription just silently stops being
-- billed with nobody aware. These columns let the webhook flag that state
-- so it's visible in /admin instead of buried in function logs.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS tax_location_invalid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tax_issue_detected_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.admin_list_tax_issues()
RETURNS TABLE(
  user_id UUID,
  email TEXT,
  display_name TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  tax_issue_detected_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY
    SELECT s.user_id,
           u.email::TEXT,
           p.display_name,
           s.stripe_customer_id,
           s.stripe_subscription_id,
           s.status,
           s.tax_issue_detected_at
      FROM public.subscriptions s
      LEFT JOIN auth.users u ON u.id = s.user_id
      LEFT JOIN public.profiles p ON p.user_id = s.user_id
     WHERE s.tax_location_invalid = true
     ORDER BY s.tax_issue_detected_at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_tax_issues() TO authenticated;
