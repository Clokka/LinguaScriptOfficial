-- Keep the database small: delete cache and log rows nothing reads any more.
-- Runs once now (to free space straight away) and then every night.
-- Never touches learner data (saved words, progress, streaks, profiles).
CREATE OR REPLACE FUNCTION public.purge_stale_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- youtube-search only trusts rows younger than 24h, so a week-old row is dead weight.
  DELETE FROM public.youtube_search_cache WHERE updated_at < now() - interval '7 days';
  -- Daily-limit counter: fetch-captions only looks at the last 24h.
  DELETE FROM public.caption_fetch_log WHERE created_at < now() - interval '2 days';
  -- Email log is only read for retry/dedupe of messages still in the queue.
  DELETE FROM public.email_send_log WHERE created_at < now() - interval '30 days';
  -- pg_cron keeps a row for every run (push/retention run every 15 min) forever.
  DELETE FROM cron.job_run_details WHERE end_time < now() - interval '3 days';
  -- pg_net keeps every HTTP response the cron jobs got back.
  BEGIN
    DELETE FROM net._http_response WHERE created < now() - interval '1 day';
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN NULL;
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_stale_data() FROM PUBLIC, anon, authenticated;

SELECT public.purge_stale_data();

DO $$ BEGIN PERFORM cron.unschedule('purge-stale-data'); EXCEPTION WHEN OTHERS THEN NULL; END $$;
SELECT cron.schedule('purge-stale-data', '23 3 * * *', $$SELECT public.purge_stale_data();$$);
