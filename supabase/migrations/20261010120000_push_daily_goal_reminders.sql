-- Daily word-goal push reminders (supabase/functions/dispatch-push-notifications).
-- One reminder at the learner's chosen time, then at most one "almost there"
-- nudge; these columns record when each last went out so each fires once per
-- local day.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_goal_push_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_goal_nudge_at timestamptz;

-- Run the dispatcher every 15 minutes. It shares the private x-cron-secret
-- with dispatch-retention-emails (vault secret 'retention_dispatch_secret' ==
-- Edge Function secret RETENTION_DISPATCH_SECRET); without it the function
-- answers 401 and sends nothing.
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'push-dispatch';

SELECT cron.schedule(
  'push-dispatch',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ffephracinqeylfhqkiz.supabase.co/functions/v1/dispatch-push-notifications',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA',
      'x-cron-secret', COALESCE(
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'retention_dispatch_secret' LIMIT 1),
        ''
      )
    ),
    body := '{}'::jsonb
  );
  $cron$
);
