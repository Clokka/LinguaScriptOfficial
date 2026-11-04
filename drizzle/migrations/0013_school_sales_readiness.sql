CREATE TABLE public.school_enquiries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_name text NOT NULL,
 contact_name text NOT NULL,
 email text NOT NULL,
 student_count integer,
 needs text NOT NULL,
 status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','closed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.school_enquiries TO authenticated;
GRANT ALL ON public.school_enquiries TO service_role;
ALTER TABLE public.school_enquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "site team reads school enquiries" ON public.school_enquiries FOR SELECT TO authenticated USING (public.is_site_team(auth.uid()));
CREATE POLICY "site team updates school enquiries" ON public.school_enquiries FOR UPDATE TO authenticated USING (public.is_site_team(auth.uid())) WITH CHECK (public.is_site_team(auth.uid()));
CREATE OR REPLACE FUNCTION public.submit_school_enquiry(_school text, _name text, _email text, _students integer, _needs text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result uuid;
BEGIN
 IF length(trim(coalesce(_school,''))) NOT BETWEEN 2 AND 160 OR length(trim(coalesce(_name,''))) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Please enter your name and school.'; END IF;
 IF length(coalesce(_email,'')) > 254 OR trim(coalesce(_email,'')) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'Please enter a valid email address.'; END IF;
 IF _students IS NOT NULL AND (_students < 1 OR _students > 100000) THEN RAISE EXCEPTION 'Please enter a valid student count.'; END IF;
 IF length(trim(coalesce(_needs,''))) NOT BETWEEN 5 AND 2000 THEN RAISE EXCEPTION 'Please describe what your school needs (5–2000 characters).'; END IF;
 INSERT INTO public.school_enquiries(school_name,contact_name,email,student_count,needs) VALUES(trim(_school),trim(_name),lower(trim(_email)),_students,trim(_needs)) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.submit_school_enquiry(text,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_school_enquiry(text,text,text,integer,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.accept_school_invite(_token text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE inv RECORD; account_email text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 SELECT email::text INTO account_email FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL;
 IF account_email IS NULL THEN RAISE EXCEPTION 'Confirm your email before joining your school.'; END IF;
 SELECT * INTO inv FROM public.school_invites WHERE token = _token AND status = 'pending' LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This invitation is no longer available. Ask your teacher for a new link.'; END IF;
 IF lower(trim(account_email)) <> lower(trim(inv.email)) THEN RAISE EXCEPTION 'Sign in with the email address your teacher invited.'; END IF;
 INSERT INTO public.school_members(school_id,user_id,member_role) VALUES(inv.school_id,auth.uid(),inv.member_role) ON CONFLICT(school_id,user_id) DO NOTHING;
 UPDATE public.school_invites SET status='accepted', accepted_at=now(), accepted_by=auth.uid() WHERE id=inv.id;
 RETURN inv.school_id;
END $$;
REVOKE ALL ON FUNCTION public.accept_school_invite(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_school_invite(text) TO authenticated, service_role;
-- Membership and invitation writes use the authorised RPCs, not direct table writes.
REVOKE INSERT, UPDATE, DELETE ON public.school_members FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.school_invites FROM authenticated;

CREATE OR REPLACE FUNCTION public.school_class_progress(_school_id uuid)
RETURNS TABLE(user_id uuid,display_name text,email text,learning_language text,streak_count integer,words_learned integer,words_this_week integer,reviews_this_week integer,minutes_this_week integer,minutes_total integer,last_active_at timestamptz,joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF auth.uid() IS NULL OR (NOT public.is_school_staff(_school_id,auth.uid()) AND NOT public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN QUERY
 SELECT sm.user_id, public.safe_display_name(p.user_id,p.display_name,p.username), u.email::text, p.learning_language::text, coalesce(p.streak_count,0)::integer,
 (SELECT count(*)::integer FROM public.saved_words sw WHERE sw.user_id=sm.user_id AND sw.language=p.learning_language AND sw.state='green' AND sw.review_count>0 AND sw.next_review <> date '2999-01-01'),
 coalesce(a.words,0)::integer, coalesce(a.reviews,0)::integer, coalesce(a.minutes_week,0)::integer, coalesce(a.minutes_all,0)::integer, a.last_active, sm.joined_at
 FROM public.school_members sm
 JOIN public.profiles p ON p.user_id=sm.user_id
 JOIN auth.users u ON u.id=sm.user_id
 LEFT JOIN LATERAL (
 SELECT sum(al.words_learned) FILTER(WHERE al.date >= current_date - 6) AS words,
 sum(al.words_reviewed) FILTER(WHERE al.date >= current_date - 6) AS reviews,
 sum(al.minutes_watched) FILTER(WHERE al.date >= current_date - 6) AS minutes_week,
 sum(al.minutes_watched) AS minutes_all,
 max(al.date)::timestamptz AS last_active
 FROM public.activity_log al WHERE al.user_id=sm.user_id AND al.language=p.learning_language AND (coalesce(al.minutes_watched,0)>0 OR coalesce(al.words_learned,0)>0 OR al.words_reviewed>0 OR coalesce(al.videos_watched,0)>0)
 ) a ON true
 WHERE sm.school_id=_school_id AND sm.member_role='student' ORDER BY a.last_active ASC NULLS FIRST;
END $$;
REVOKE ALL ON FUNCTION public.school_class_progress(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.school_class_progress(uuid) TO authenticated, service_role;
COMMENT ON FUNCTION public.school_class_progress(uuid) IS 'Active profile language; excludes seeded vocabulary. Weekly reviews and watched minutes are activity-log totals, not proficiency or pronunciation scores.';