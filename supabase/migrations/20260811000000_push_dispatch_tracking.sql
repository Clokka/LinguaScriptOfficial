-- Tracking columns for push notification dispatch throttling.
-- Mirrors the email throttle columns in profiles and friendship_events.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_streak_push_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_flashcard_push_at timestamptz;

ALTER TABLE public.friendship_events
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;

CREATE INDEX IF NOT EXISTS friendship_events_push_pending_idx
  ON public.friendship_events (created_at) WHERE push_sent_at IS NULL;

-- pg_cron job: dispatch push notifications every 15 minutes.
SELECT cron.schedule(
  'push-dispatch',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ffephracinqeylfhqkiz.supabase.co/functions/v1/dispatch-push-notifications',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
