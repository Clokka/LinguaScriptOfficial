
-- Profile additions for email prefs, throttling, discoverability
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS discoverable_by_search boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_prefs jsonb NOT NULL DEFAULT
    '{"review_reminders":true,"streak_rescue":true,"friend_requests":true,"weekly_report":true,"monthly_report":true,"rank_overtaken":false}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_review_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_streak_rescue_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_weekly_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_monthly_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_friend_email_at timestamptz,
  ADD COLUMN IF NOT EXISTS review_emails_week_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_emails_week_start date,
  ADD COLUMN IF NOT EXISTS streak_rescue_for_streak int;

-- Friendship event log to drive immediate notifications without DB net calls inside trigger
CREATE TABLE IF NOT EXISTS public.friendship_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('request_received','request_accepted')),
  email_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.friendship_events TO authenticated;
GRANT ALL ON public.friendship_events TO service_role;
ALTER TABLE public.friendship_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own friendship events" ON public.friendship_events
  FOR SELECT TO authenticated USING (recipient_id = auth.uid());
CREATE INDEX IF NOT EXISTS friendship_events_pending_idx
  ON public.friendship_events (created_at) WHERE email_sent_at IS NULL;

-- Trigger: when a friendship row is inserted/updated, append an event row
CREATE OR REPLACE FUNCTION public.log_friendship_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.friendship_events (recipient_id, actor_id, kind)
      VALUES (NEW.friend_id, NEW.user_id, 'request_received');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND COALESCE(OLD.status,'') <> 'accepted' THEN
    -- The accepter is NEW.user_id (set up by accept_friend_request RPC); notify the original requester
    INSERT INTO public.friendship_events (recipient_id, actor_id, kind)
      VALUES (NEW.friend_id, NEW.user_id, 'request_accepted');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_friendship_event ON public.friendships;
CREATE TRIGGER trg_log_friendship_event
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.log_friendship_event();

-- Update user email prefs
CREATE OR REPLACE FUNCTION public.update_email_prefs(_prefs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE merged jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles
     SET email_prefs = COALESCE(email_prefs, '{}'::jsonb) || COALESCE(_prefs, '{}'::jsonb)
   WHERE user_id = auth.uid()
   RETURNING email_prefs INTO merged;
  RETURN merged;
END;
$$;

-- Update privacy/discovery
CREATE OR REPLACE FUNCTION public.update_privacy_settings(_show_on_leaderboard boolean, _discoverable boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.profiles
     SET show_on_global_leaderboard = COALESCE(_show_on_leaderboard, show_on_global_leaderboard),
         discoverable_by_search = COALESCE(_discoverable, discoverable_by_search)
   WHERE user_id = auth.uid();
END;
$$;

-- Schedule cron to run dispatcher every 15 minutes
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('retention-dispatch');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'retention-dispatch',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://ffephracinqeylfhqkiz.supabase.co/functions/v1/dispatch-retention-emails',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmZXBocmFjaW5xZXlsZmhxa2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTc4MDgsImV4cCI6MjA5MDE5MzgwOH0.CzCejyUYY1i6-T_gCxkLqq_Cmc1OSRlXAhmPC-Ud4zA'
    ),
    body := '{}'::jsonb
  );
  $cron$
);
