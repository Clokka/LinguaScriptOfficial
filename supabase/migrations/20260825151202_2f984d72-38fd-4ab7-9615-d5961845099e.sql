CREATE TABLE public.pro_chameleon_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  label text,
  pet_id text NOT NULL DEFAULT 'chameleon',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pro_chameleon_links TO authenticated;
GRANT ALL ON public.pro_chameleon_links TO service_role;

ALTER TABLE public.pro_chameleon_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pro chameleon links"
ON public.pro_chameleon_links FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pro_chameleon_links_updated_at
BEFORE UPDATE ON public.pro_chameleon_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pro_chameleon_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.pro_chameleon_links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  pet_id text NOT NULL DEFAULT 'chameleon',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_id, user_id)
);

GRANT SELECT, INSERT ON public.pro_chameleon_claims TO authenticated;
GRANT ALL ON public.pro_chameleon_claims TO service_role;

ALTER TABLE public.pro_chameleon_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pro chameleon claim"
ON public.pro_chameleon_claims FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all pro chameleon claims"
ON public.pro_chameleon_claims FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.create_pro_chameleon_link(_label text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _token text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('error', 'not_admin');
  END IF;
  _token := replace(gen_random_uuid()::text, '-', '') || substr(md5(gen_random_uuid()::text), 1, 8);
  INSERT INTO public.pro_chameleon_links (token, label, created_by)
  VALUES (_token, NULLIF(btrim(_label), ''), auth.uid());
  RETURN json_build_object('token', _token);
END;
$$;

CREATE OR REPLACE FUNCTION public.preview_pro_chameleon_link(_token text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE r public.pro_chameleon_links%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.pro_chameleon_links WHERE token = _token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;
  IF NOT r.active THEN RETURN json_build_object('error', 'inactive'); END IF;
  RETURN json_build_object('ok', true, 'label', r.label, 'pet_id', r.pet_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_pro_chameleon_link(_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r public.pro_chameleon_links%ROWTYPE;
  _uid uuid := auth.uid();
  _email text;
BEGIN
  IF _uid IS NULL THEN RETURN json_build_object('error', 'not_signed_in'); END IF;

  SELECT * INTO r FROM public.pro_chameleon_links WHERE token = _token;
  IF NOT FOUND THEN RETURN json_build_object('error', 'not_found'); END IF;
  IF NOT r.active THEN RETURN json_build_object('error', 'inactive'); END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  INSERT INTO public.pro_chameleon_claims (link_id, user_id, email, pet_id)
  VALUES (r.id, _uid, _email, r.pet_id)
  ON CONFLICT (link_id, user_id) DO NOTHING;

  IF NOT EXISTS (
    SELECT 1 FROM public.pet_collection WHERE user_id = _uid AND pet_id = r.pet_id
  ) THEN
    INSERT INTO public.pet_collection (user_id, pet_id) VALUES (_uid, r.pet_id);
  END IF;

  UPDATE public.profiles
     SET is_pro = true,
         pro_source = 'admin_grant',
         pro_expires_at = NULL,
         pro_granted_by = r.created_by,
         pro_granted_at = now(),
         active_pet = COALESCE(active_pet, r.pet_id),
         updated_at = now()
   WHERE user_id = _uid;

  RETURN json_build_object('ok', true, 'pet_id', r.pet_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_pro_chameleon_claims()
RETURNS TABLE(user_id uuid, email text, display_name text, username text, link_label text, is_pro boolean, claimed_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.user_id, c.email, p.display_name, p.username, l.label, COALESCE(p.is_pro, false), c.created_at
  FROM public.pro_chameleon_claims c
  JOIN public.pro_chameleon_links l ON l.id = c.link_id
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE public.has_role(auth.uid(), 'admin')
  ORDER BY c.created_at DESC
$$;

REVOKE ALL ON FUNCTION public.create_pro_chameleon_link(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_pro_chameleon_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_pro_chameleon_link(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pro_chameleon_link(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_pro_chameleon_claims() TO authenticated;