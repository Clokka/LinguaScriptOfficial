CREATE OR REPLACE FUNCTION public.expire_lapsed_pro()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  UPDATE public.profiles
     SET is_pro = false,
         pro_source = 'none',
         updated_at = now()
   WHERE is_pro = true
     AND pro_expires_at IS NOT NULL
     AND pro_expires_at < now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_lapsed_pro() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_lapsed_pro() TO service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'expire-lapsed-pro';
SELECT cron.schedule('expire-lapsed-pro', '7 * * * *', $$SELECT public.expire_lapsed_pro();$$);