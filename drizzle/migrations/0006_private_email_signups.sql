-- Email signups were readable by anyone (privacy / GDPR risk). Make them admin-only.
DROP POLICY IF EXISTS "Anyone can view email signups" ON public.email_signups;
DROP POLICY IF EXISTS "Admins can view email signups" ON public.email_signups;
CREATE POLICY "Admins can view email signups" ON public.email_signups FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Where each signup came from (utm source / campaign or referrer), for the waitlist page.
ALTER TABLE public.email_signups ADD COLUMN IF NOT EXISTS source text;

-- Public signup count only (no emails), used for social proof on /landing.
CREATE OR REPLACE FUNCTION public.email_signup_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.email_signups;
$$;
REVOKE ALL ON FUNCTION public.email_signup_count() FROM public;
GRANT EXECUTE ON FUNCTION public.email_signup_count() TO anon, authenticated;
