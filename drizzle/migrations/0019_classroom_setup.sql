-- LinguaScript Classroom: rerunnable classroom task and calendar setup.
-- This mirrors docs/sql/classroom-setup.sql, with user IDs kept as plain UUIDs
-- in new application tables per the project's schema policy.

-- Teacher video tasks.
CREATE TABLE IF NOT EXISTS public.class_assignments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
 film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
 note text CHECK (note IS NULL OR length(note) <= 500),
 due_at timestamptz,
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (school_id, film_id)
);
CREATE INDEX IF NOT EXISTS class_assignments_school_idx ON public.class_assignments(school_id);
CREATE INDEX IF NOT EXISTS class_assignments_film_idx ON public.class_assignments(film_id);
GRANT SELECT ON public.class_assignments TO authenticated;
GRANT ALL ON public.class_assignments TO service_role;
ALTER TABLE public.class_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "class members read tasks" ON public.class_assignments;
CREATE POLICY "class members read tasks" ON public.class_assignments FOR SELECT TO authenticated
 USING (EXISTS (SELECT 1 FROM public.school_members sm WHERE sm.school_id = class_assignments.school_id AND sm.user_id = auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.create_class_assignment(_school_id uuid, _film_id uuid, _note text, _due_at timestamptz)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_school_staff(_school_id, auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.films WHERE id = _film_id) THEN RAISE EXCEPTION 'That video was not found in LinguaScript.'; END IF;
 IF length(coalesce(_note,'')) > 500 THEN RAISE EXCEPTION 'Keep the note under 500 characters.'; END IF;
 INSERT INTO public.class_assignments(school_id, film_id, note, due_at, created_by)
 VALUES (_school_id, _film_id, nullif(trim(coalesce(_note,'')),''), _due_at, auth.uid())
 ON CONFLICT (school_id, film_id) DO UPDATE SET note = EXCLUDED.note, due_at = EXCLUDED.due_at
 RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.create_class_assignment(uuid,uuid,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_class_assignment(uuid,uuid,text,timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_class_assignment(_assignment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sid uuid;
BEGIN
 SELECT school_id INTO sid FROM public.class_assignments WHERE id = _assignment_id;
 IF sid IS NULL THEN RETURN; END IF;
 IF auth.uid() IS NULL OR NOT public.is_school_staff(sid, auth.uid()) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 DELETE FROM public.class_assignments WHERE id = _assignment_id;
END $$;
REVOKE ALL ON FUNCTION public.delete_class_assignment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_class_assignment(uuid) TO authenticated, service_role;

-- Replace broad activity reporting with assigned-video-only progress.
DROP FUNCTION IF EXISTS public.school_class_progress(uuid);
CREATE FUNCTION public.school_class_progress(_school_id uuid)
RETURNS TABLE(user_id uuid, display_name text, email text, joined_at timestamptz, tasks_set integer, tasks_started integer, tasks_done integer, last_task_activity timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR (NOT public.is_school_staff(_school_id, auth.uid()) AND NOT public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN QUERY
 SELECT sm.user_id, public.safe_display_name(p.user_id, p.display_name, p.username), u.email::text, sm.joined_at,
  (SELECT count(*)::integer FROM public.class_assignments ca WHERE ca.school_id = _school_id),
  coalesce(t.started, 0)::integer, coalesce(t.done, 0)::integer, t.last_at
 FROM public.school_members sm
 JOIN auth.users u ON u.id = sm.user_id
 LEFT JOIN public.profiles p ON p.user_id = sm.user_id
 LEFT JOIN LATERAL (
  SELECT count(*) AS started, count(*) FILTER (WHERE wh.completion_pct >= 90) AS done, max(wh.watched_at) AS last_at
  FROM public.class_assignments ca
  JOIN public.watch_history wh ON wh.user_id = sm.user_id AND wh.film_id = ca.film_id
  WHERE ca.school_id = _school_id AND wh.watched_at >= ca.created_at AND wh.watched_at >= sm.joined_at
 ) t ON true
 WHERE sm.school_id = _school_id AND sm.member_role = 'student'
 ORDER BY t.last_at ASC NULLS FIRST;
END $$;
REVOKE ALL ON FUNCTION public.school_class_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_class_progress(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.school_class_progress(uuid) IS 'Assigned videos only, counted from viewing after the task was set and after the student joined. No app-wide activity.';

CREATE OR REPLACE FUNCTION public.class_assignment_progress(_school_id uuid)
RETURNS TABLE(assignment_id uuid, user_id uuid, watched_pct numeric, watch_count integer, green_pct numeric, last_watched_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR (NOT public.is_school_staff(_school_id, auth.uid()) AND NOT public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN QUERY
 SELECT ca.id, sm.user_id,
  CASE WHEN wh.watched_at >= greatest(ca.created_at, sm.joined_at) THEN wh.completion_pct END,
  CASE WHEN vc.last_watched_at >= greatest(ca.created_at, sm.joined_at) THEN vc.watch_count END,
  CASE WHEN vc.last_watched_at >= greatest(ca.created_at, sm.joined_at) THEN vc.latest_score END,
  CASE WHEN wh.watched_at >= greatest(ca.created_at, sm.joined_at) THEN wh.watched_at END
 FROM public.class_assignments ca
 JOIN public.school_members sm ON sm.school_id = ca.school_id AND sm.member_role = 'student'
 LEFT JOIN public.watch_history wh ON wh.user_id = sm.user_id AND wh.film_id = ca.film_id
 LEFT JOIN public.video_comprehension vc ON vc.user_id = sm.user_id AND vc.content_type = 'film' AND vc.content_id = ca.film_id
 WHERE ca.school_id = _school_id;
END $$;
REVOKE ALL ON FUNCTION public.class_assignment_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.class_assignment_progress(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_class_tasks()
RETURNS TABLE(assignment_id uuid, school_id uuid, school_name text, film_id uuid, title text, thumbnail_url text, note text, due_at timestamptz, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT ca.id, s.id, s.name, f.id, f.title, f.thumbnail_url, ca.note, ca.due_at, ca.created_at
 FROM public.school_members sm
 JOIN public.schools s ON s.id = sm.school_id
 JOIN public.class_assignments ca ON ca.school_id = sm.school_id
 JOIN public.films f ON f.id = ca.film_id
 WHERE sm.user_id = auth.uid() AND sm.member_role = 'student'
 ORDER BY ca.due_at ASC NULLS LAST, ca.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.my_class_tasks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_class_tasks() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leave_school(_school_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 DELETE FROM public.school_members WHERE school_id = _school_id AND user_id = auth.uid() AND member_role = 'student';
END $$;
REVOKE ALL ON FUNCTION public.leave_school(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_school(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.forget_video(_film_id uuid, _video_id text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 DELETE FROM public.watch_history WHERE user_id = uid AND ((_film_id IS NOT NULL AND film_id = _film_id) OR (_video_id IS NOT NULL AND video_id = _video_id));
 IF _film_id IS NOT NULL THEN
  DELETE FROM public.video_comprehension WHERE user_id = uid AND content_type = 'film' AND content_id = _film_id;
  DELETE FROM public.watch_sessions WHERE user_id = uid AND film_id = _film_id;
  UPDATE public.profiles SET watch_progress = watch_progress - _film_id::text WHERE user_id = uid AND watch_progress ? _film_id::text;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.forget_video(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forget_video(uuid,text) TO authenticated, service_role;

-- Remove the previous report that exposed whole-app activity to teachers.
DROP FUNCTION IF EXISTS public.list_school_students(uuid);

-- Private personal calendar feed tokens; accessed only through the RPC.
CREATE TABLE IF NOT EXISTS public.calendar_feed_tokens (
 user_id uuid PRIMARY KEY,
 token text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.calendar_feed_tokens TO service_role;
ALTER TABLE public.calendar_feed_tokens ENABLE ROW LEVEL SECURITY;
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

-- Calendar OAuth tokens are server-only; no user-facing policies or grants.
CREATE TABLE IF NOT EXISTS public.google_calendar_connections (
 user_id uuid PRIMARY KEY,
 access_token text NOT NULL,
 refresh_token text,
 expires_at timestamptz NOT NULL,
 scope text,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.google_calendar_connections TO service_role;
ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';