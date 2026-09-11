-- Security fix: dispatch-retention-emails has verify_jwt = false (pg_cron
-- can only attach the public anon key, not a real user session, so it can't
-- pass Supabase JWT auth) and, until now, performed no check of its own —
-- meaning anyone could POST directly to the function's public URL and
-- trigger real retention emails to real users ahead of schedule. The
-- function itself now requires a private `x-cron-secret` header
-- (see supabase/functions/dispatch-retention-emails/index.ts); this
-- migration updates the cron job to send it, sourced from Supabase Vault
-- rather than hardcoded in a migration file.
--
-- ONE-TIME MANUAL STEP required after this migration runs — pick a long
-- random value and set it in BOTH places (they must match):
--   1. SQL: select vault.create_secret('<value>', 'retention_dispatch_secret');
--   2. Edge Function secret: RETENTION_DISPATCH_SECRET=<the same value>
--      (Dashboard -> Edge Functions -> Secrets, or `supabase secrets set`).
-- Until both are set, the cron job's request gets a 401 and no emails send
-- — a safe failure mode (silence), not a new open endpoint.
CREATE EXTENSION IF NOT EXISTS supabase_vault;

SELECT cron.unschedule('retention-dispatch');

SELECT cron.schedule(
  'retention-dispatch',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ffephracinqeylfhqkiz.supabase.co/functions/v1/dispatch-retention-emails',
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
