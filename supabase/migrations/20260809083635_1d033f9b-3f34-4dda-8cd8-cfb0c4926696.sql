CREATE TABLE public.pro_gift_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  days integer,
  note text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pro_gift_links TO authenticated;
GRANT ALL ON public.pro_gift_links TO service_role;

ALTER TABLE public.pro_gift_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view pro gift links"
ON public.pro_gift_links FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create pro gift links"
ON public.pro_gift_links FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') AND created_by = auth.uid());

CREATE TRIGGER update_pro_gift_links_updated_at
BEFORE UPDATE ON public.pro_gift_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.create_pro_gift_link(_days integer DEFAULT NULL, _note text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _token text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('error', 'not_admin');
  END IF;
  _token := encode(gen_random_bytes(16), 'hex');
  INSERT INTO public.pro_gift_links (token, days, note, created_by)
  VALUES (_token, NULLIF(_days, 0), _note, auth.uid());
  RETURN json_build_object('token', _token);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_pro_gift_link(_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.pro_gift_links%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.pro_gift_links WHERE token = _token;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;
  RETURN json_build_object(
    'days', r.days,
    'note', r.note,
    'claimed', r.claimed_by IS NOT NULL,
    'expired', r.expires_at < now()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_pro_gift_link(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.pro_gift_links%ROWTYPE;
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN json_build_object('error', 'not_signed_in');
  END IF;

  SELECT * INTO r FROM public.pro_gift_links WHERE token = _token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;
  IF r.claimed_by IS NOT NULL THEN
    RETURN json_build_object('error', 'already_claimed');
  END IF;
  IF r.expires_at < now() THEN
    RETURN json_build_object('error', 'expired');
  END IF;

  UPDATE public.pro_gift_links
     SET claimed_by = _uid, claimed_at = now()
   WHERE id = r.id;

  UPDATE public.profiles
     SET is_pro = true,
         pro_source = 'admin_grant',
         pro_expires_at = CASE WHEN r.days IS NULL THEN NULL ELSE now() + (r.days || ' days')::interval END,
         pro_granted_by = r.created_by,
         pro_granted_at = now(),
         updated_at = now()
   WHERE user_id = _uid;

  RETURN json_build_object('ok', true, 'days', r.days);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_pro_gift_link(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_pro_gift_link(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.claim_pro_gift_link(text) TO authenticated;