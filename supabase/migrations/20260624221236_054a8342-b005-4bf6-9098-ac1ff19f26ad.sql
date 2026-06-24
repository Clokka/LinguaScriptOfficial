
-- 1) Roles
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'student';

-- 2) Schools
CREATE TABLE public.schools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schools TO authenticated;
GRANT ALL ON public.schools TO service_role;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 3) Members
CREATE TABLE public.school_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  member_role text NOT NULL CHECK (member_role IN ('teacher','student','school_admin')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_members TO authenticated;
GRANT ALL ON public.school_members TO service_role;
ALTER TABLE public.school_members ENABLE ROW LEVEL SECURITY;

CREATE INDEX school_members_user_idx ON public.school_members(user_id);
CREATE INDEX school_members_school_idx ON public.school_members(school_id);

-- 4) Invites
CREATE TABLE public.school_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  email text NOT NULL,
  member_role text NOT NULL DEFAULT 'student' CHECK (member_role IN ('teacher','student')),
  token text UNIQUE NOT NULL,
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','revoked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  accepted_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_invites TO authenticated;
GRANT ALL ON public.school_invites TO service_role;
ALTER TABLE public.school_invites ENABLE ROW LEVEL SECURITY;

CREATE INDEX school_invites_school_idx ON public.school_invites(school_id);
CREATE INDEX school_invites_email_idx ON public.school_invites(lower(email));

-- 5) Helper: is current user a teacher (or admin) of a school?
CREATE OR REPLACE FUNCTION public.is_school_staff(_school_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_members
     WHERE school_id = _school_id
       AND user_id = _user_id
       AND member_role IN ('teacher','school_admin')
  );
$$;

-- 6) RLS policies
CREATE POLICY "members can view their schools" ON public.schools
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.school_members sm
             WHERE sm.school_id = schools.id AND sm.user_id = auth.uid())
    OR has_role(auth.uid(),'admin')
  );

CREATE POLICY "platform admin manages schools" ON public.schools
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "users can see their own memberships" ON public.school_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_school_staff(school_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "teachers manage memberships in their school" ON public.school_members
  FOR ALL TO authenticated
  USING (public.is_school_staff(school_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_staff(school_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "teachers view invites in their school" ON public.school_invites
  FOR SELECT TO authenticated
  USING (public.is_school_staff(school_id, auth.uid()) OR has_role(auth.uid(),'admin'));

CREATE POLICY "teachers manage invites in their school" ON public.school_invites
  FOR ALL TO authenticated
  USING (public.is_school_staff(school_id, auth.uid()) OR has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_school_staff(school_id, auth.uid()) OR has_role(auth.uid(),'admin'));

-- 7) Functions
CREATE OR REPLACE FUNCTION public.create_school(_name text, _slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _name IS NULL OR length(trim(_name)) = 0 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _slug IS NULL OR _slug !~ '^[a-z0-9-]{3,40}$' THEN RAISE EXCEPTION 'invalid_slug'; END IF;

  INSERT INTO public.schools (name, slug, created_by)
  VALUES (trim(_name), _slug, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.school_members (school_id, user_id, member_role)
  VALUES (new_id, auth.uid(), 'school_admin');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (auth.uid(), 'teacher')
  ON CONFLICT DO NOTHING;

  RETURN new_id;
END; $$;

CREATE OR REPLACE FUNCTION public.bulk_invite_students(_school_id uuid, _emails text[])
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e text;
  cleaned text;
  tok text;
  count_inserted int := 0;
BEGIN
  IF NOT public.is_school_staff(_school_id, auth.uid()) AND NOT has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  FOREACH e IN ARRAY _emails LOOP
    cleaned := lower(trim(e));
    CONTINUE WHEN cleaned !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$';

    tok := encode(gen_random_bytes(18), 'base64');
    tok := replace(replace(replace(tok, '+', '-'), '/', '_'), '=', '');

    INSERT INTO public.school_invites (school_id, email, member_role, token, invited_by)
    VALUES (_school_id, cleaned, 'student', tok, auth.uid());
    count_inserted := count_inserted + 1;
  END LOOP;

  RETURN count_inserted;
END; $$;

CREATE OR REPLACE FUNCTION public.accept_school_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO inv FROM public.school_invites
   WHERE token = _token AND status = 'pending' LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'invite_not_found'; END IF;

  INSERT INTO public.school_members (school_id, user_id, member_role)
  VALUES (inv.school_id, auth.uid(), inv.member_role)
  ON CONFLICT (school_id, user_id) DO NOTHING;

  UPDATE public.school_invites
     SET status = 'accepted', accepted_at = now(), accepted_by = auth.uid()
   WHERE id = inv.id;

  RETURN inv.school_id;
END; $$;

CREATE OR REPLACE FUNCTION public.list_school_students(_school_id uuid)
RETURNS TABLE(
  user_id uuid,
  display_name text,
  email text,
  xp_total int,
  xp_level int,
  streak_count int,
  words_known int,
  minutes_watched int,
  joined_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_school_staff(_school_id, auth.uid()) AND NOT has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  RETURN QUERY
  SELECT
    sm.user_id,
    public.safe_display_name(p.user_id, p.display_name, p.username) AS display_name,
    u.email::text,
    COALESCE(p.xp_total,0)::int,
    COALESCE(p.xp_level,1)::int,
    COALESCE(p.streak_count,0)::int,
    (SELECT count(*)::int FROM public.saved_words sw
       WHERE sw.user_id = sm.user_id AND sw.state = 'green'),
    (SELECT COALESCE(sum(wh.position_seconds),0)::int / 60 FROM public.watch_history wh
       WHERE wh.user_id = sm.user_id),
    sm.joined_at
  FROM public.school_members sm
  LEFT JOIN public.profiles p ON p.user_id = sm.user_id
  LEFT JOIN auth.users u ON u.id = sm.user_id
  WHERE sm.school_id = _school_id
    AND sm.member_role = 'student'
  ORDER BY sm.joined_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.my_schools()
RETURNS TABLE(school_id uuid, name text, slug text, member_role text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.id, s.name, s.slug, sm.member_role
    FROM public.school_members sm
    JOIN public.schools s ON s.id = sm.school_id
   WHERE sm.user_id = auth.uid();
$$;

CREATE TRIGGER schools_updated_at BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
