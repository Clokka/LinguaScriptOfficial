CREATE OR REPLACE FUNCTION public.create_pro_gift_link(_days integer DEFAULT NULL::integer, _note text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _token text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('error', 'not_admin');
  END IF;
  _token := replace(gen_random_uuid()::text, '-', '') || substr(md5(gen_random_uuid()::text), 1, 8);
  INSERT INTO public.pro_gift_links (token, days, note, created_by)
  VALUES (_token, NULLIF(_days, 0), _note, auth.uid());
  RETURN json_build_object('token', _token);
END;
$function$;

CREATE OR REPLACE FUNCTION public.bulk_invite_students(_school_id uuid, _emails text[])
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    tok := replace(gen_random_uuid()::text, '-', '');

    INSERT INTO public.school_invites (school_id, email, member_role, token, invited_by)
    VALUES (_school_id, cleaned, 'student', tok, auth.uid());
    count_inserted := count_inserted + 1;
  END LOOP;

  RETURN count_inserted;
END; $function$;