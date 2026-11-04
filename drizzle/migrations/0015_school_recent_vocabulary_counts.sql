CREATE OR REPLACE FUNCTION public.school_class_progress(_school_id uuid)
RETURNS TABLE(user_id uuid,display_name text,email text,learning_language text,streak_count integer,words_learned integer,words_this_week integer,reviews_this_week integer,minutes_this_week integer,minutes_total integer,last_active_at timestamptz,joined_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR (NOT public.is_school_staff(_school_id,auth.uid()) AND NOT public.has_role(auth.uid(),'admin')) THEN RAISE EXCEPTION 'not_authorized'; END IF;
 RETURN QUERY
 SELECT sm.user_id, public.safe_display_name(p.user_id,p.display_name,p.username), u.email::text, p.learning_language::text, coalesce(p.streak_count,0)::integer,
 (SELECT count(*)::integer FROM public.saved_words sw WHERE sw.user_id=sm.user_id AND sw.language=p.learning_language AND sw.state='green' AND sw.review_count>0 AND sw.next_review<>date '2999-01-01'),
 (SELECT count(*)::integer FROM public.saved_words sw WHERE sw.user_id=sm.user_id AND sw.language=p.learning_language AND sw.created_at>=date_trunc('day',now())-interval '6 days' AND sw.next_review<>date '2999-01-01' AND (sw.state<>'green' OR sw.review_count>0)),
 coalesce(a.reviews,0)::integer,coalesce(a.minutes_week,0)::integer,coalesce(a.minutes_all,0)::integer,a.last_active,sm.joined_at
 FROM public.school_members sm JOIN public.profiles p ON p.user_id=sm.user_id JOIN auth.users u ON u.id=sm.user_id
 LEFT JOIN LATERAL (
 SELECT sum(al.words_reviewed) FILTER(WHERE al.date>=current_date-6) AS reviews,
 sum(al.minutes_watched) FILTER(WHERE al.date>=current_date-6) AS minutes_week,sum(al.minutes_watched) AS minutes_all,max(al.date)::timestamptz AS last_active
 FROM public.activity_log al WHERE al.user_id=sm.user_id AND al.language=p.learning_language AND (coalesce(al.minutes_watched,0)>0 OR al.words_reviewed>0 OR coalesce(al.videos_watched,0)>0)
 ) a ON true WHERE sm.school_id=_school_id AND sm.member_role='student' ORDER BY a.last_active ASC NULLS FIRST;
END $$;
COMMENT ON FUNCTION public.school_class_progress(uuid) IS 'Active language. words_this_week means vocabulary added in last seven UTC dates, not proficiency gained. Excludes seeded known words. Reviews/minutes use activity_log.';