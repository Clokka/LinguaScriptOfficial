-- LinguaScript Classroom ↔ Google Calendar.
-- 1) A private calendar feed (.ics) per person: clip due dates for the classes
--    they teach, and for the classes they are a student in. Google Calendar,
--    Apple Calendar and Outlook subscribe to it by URL — no Google permission.
--    The feed holds only clip titles, class names, due dates and the clip link:
--    never any student's progress, so a leaked link shows nothing private.
-- 2) Optional "Connect Google Calendar" (calendar.events scope) for teachers:
--    tokens live in google_calendar_connections, readable by the server only.

-- 1) Feed tokens.
CREATE TABLE public.calendar_feed_tokens (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 token text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.calendar_feed_tokens TO service_role;
ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;
-- No policies: people get their own token only through the RPC below.

CREATE OR REPLACE FUNCTION public.my_calendar_feed_token(_reset boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); result text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _reset THEN DELETE FROM public.calendar_feed_tokens WHERE user_id = uid; END IF;
 SELECT token INTO result FROM public.calendar_feed_tokens WHERE user_id = uid;
 IF result IS NULL THEN
  result := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  INSERT INTO public.calendar_feed_tokens(user_id, token) VALUES (uid, result);
 END IF;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.my_calendar_feed_token(boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_calendar_feed_token(boolean) TO authenticated, service_role;

-- 2) Google Calendar connection (server-only).
CREATE TABLE public.google_calendar_connections (
 user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 access_token text NOT NULL,
 refresh_token text,
 expires_at timestamptz NOT NULL,
 scope text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
-- No policies: only the google-calendar edge function (service role) reads it.
