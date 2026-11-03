-- LinguaScript HQ, part 2: change the live website from /hq.
--
--   site_drafts    shared work-in-progress pages from the Site Studio
--   site_publishes every "Go live" (newest row = what visitors get), so any
--                  version can be rolled back
--   get_live_site()  public: the one config the homepage reads
--   publish_site()   team only (admin, marketer, engineer)
--
-- The config only *chooses* things (page ids, section ids, lab + number,
-- loader ids); the website validates every value against its own lists, so a
-- config can never inject HTML.

CREATE OR REPLACE FUNCTION public.is_site_team(_uid uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
-- plpgsql (not sql) so the role names are only read when it runs: lets the whole
-- setup run in one go, in the same transaction that adds the new roles.
BEGIN
  RETURN public.has_role(_uid, 'admin') OR public.has_role(_uid, 'marketer') OR public.has_role(_uid, 'engineer');
END $$;
GRANT EXECUTE ON FUNCTION public.is_site_team(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.site_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  config jsonb NOT NULL CHECK (octet_length(config::text) < 100000),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_drafts_name ON public.site_drafts (lower(name));

CREATE TABLE IF NOT EXISTS public.site_publishes (
  id bigserial PRIMARY KEY,
  config jsonb NOT NULL CHECK (octet_length(config::text) < 100000),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_publishes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team reads drafts" ON public.site_drafts;
CREATE POLICY "team reads drafts" ON public.site_drafts FOR SELECT TO authenticated USING (public.is_site_team(auth.uid()));
DROP POLICY IF EXISTS "team writes drafts" ON public.site_drafts;
CREATE POLICY "team writes drafts" ON public.site_drafts FOR INSERT TO authenticated WITH CHECK (public.is_site_team(auth.uid()));
DROP POLICY IF EXISTS "team edits drafts" ON public.site_drafts;
CREATE POLICY "team edits drafts" ON public.site_drafts FOR UPDATE TO authenticated USING (public.is_site_team(auth.uid())) WITH CHECK (public.is_site_team(auth.uid()));
DROP POLICY IF EXISTS "team deletes drafts" ON public.site_drafts;
CREATE POLICY "team deletes drafts" ON public.site_drafts FOR DELETE TO authenticated USING (public.is_site_team(auth.uid()));
DROP POLICY IF EXISTS "team reads publishes" ON public.site_publishes;
CREATE POLICY "team reads publishes" ON public.site_publishes FOR SELECT TO authenticated USING (public.is_site_team(auth.uid()));

REVOKE ALL ON public.site_drafts, public.site_publishes FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_drafts TO authenticated;
GRANT SELECT ON public.site_publishes TO authenticated;

-- Public: what the homepage shows. NULL = nothing published yet (site keeps its built-in test).
CREATE OR REPLACE FUNCTION public.get_live_site()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT config || jsonb_build_object('published_id', id, 'published_at', created_at)
  FROM site_publishes ORDER BY id DESC LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_live_site() TO anon, authenticated;

-- Team: go live. A homepage A/B test also registers its arms as an experiment,
-- so the existing results table (Admin → Experiments) counts it.
CREATE OR REPLACE FUNCTION public.publish_site(_config jsonb, _note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id bigint; _key text; _arms text[];
BEGIN
  IF NOT public.is_site_team(auth.uid()) THEN RAISE EXCEPTION 'Only the LinguaScript team can publish'; END IF;
  IF jsonb_typeof(_config) <> 'object' OR coalesce((_config->>'version')::int, 0) <> 2 THEN
    RAISE EXCEPTION 'Unknown config version';
  END IF;
  INSERT INTO site_publishes (config, note, published_by)
  VALUES (_config - 'published_id' - 'published_at', left(_note, 200), auth.uid()) RETURNING id INTO _id;

  IF _config #>> '{home,mode}' = 'test' THEN
    _key := _config #>> '{home,key}';
    SELECT array_agg(a->>'id') INTO _arms FROM jsonb_array_elements(_config #> '{home,arms}') a;
    IF _key ~ '^[a-z0-9_]{3,40}$' AND coalesce(array_length(_arms, 1), 0) BETWEEN 2 AND 4 THEN
      BEGIN
        INSERT INTO experiments (key, name, variants, status)
        VALUES (_key, 'Homepage test (from HQ)', _arms, 'running')
        ON CONFLICT (key) DO UPDATE SET variants = EXCLUDED.variants, status = 'running';
      EXCEPTION WHEN others THEN NULL; -- results table missing: publishing still works
      END;
    END IF;
  END IF;
  RETURN _id;
END $$;
GRANT EXECUTE ON FUNCTION public.publish_site(jsonb, text) TO authenticated;

-- History for the "Go live" tab, with who published (team only).
CREATE OR REPLACE FUNCTION public.site_publish_history(_limit int DEFAULT 30)
RETURNS TABLE (id bigint, config jsonb, note text, published_by_email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_site_team(auth.uid()) THEN RETURN; END IF;
  RETURN QUERY
  SELECT p.id, p.config, p.note, u.email::text, p.created_at
  FROM site_publishes p LEFT JOIN auth.users u ON u.id = p.published_by
  ORDER BY p.id DESC LIMIT greatest(1, least(_limit, 200));
END $$;
GRANT EXECUTE ON FUNCTION public.site_publish_history(int) TO authenticated;

-- Admins give HQ logins: marketer, engineer or partner.
CREATE OR REPLACE FUNCTION public.admin_set_team_role(_email text, _role public.app_role, _grant boolean DEFAULT true)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  IF _role::text NOT IN ('marketer', 'partner', 'engineer') THEN RAISE EXCEPTION 'Only marketer, engineer or partner can be set here'; END IF;
  SELECT id INTO _uid FROM auth.users WHERE lower(email) = lower(trim(_email));
  IF _uid IS NULL THEN RAISE EXCEPTION 'No LinguaScript account uses that email yet. Ask them to sign up first.'; END IF;
  IF _grant THEN
    INSERT INTO user_roles (user_id, role) VALUES (_uid, _role) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM user_roles WHERE user_id = _uid AND role = _role;
  END IF;
  RETURN true;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_set_team_role(text, public.app_role, boolean) TO authenticated;

-- Admins see who has an HQ login.
CREATE OR REPLACE FUNCTION public.admin_team_members()
RETURNS TABLE (email text, roles text[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
  SELECT u.email::text, array_agg(r.role::text ORDER BY r.role::text)
  FROM user_roles r JOIN auth.users u ON u.id = r.user_id
  WHERE r.role::text IN ('admin', 'marketer', 'engineer', 'partner')
  GROUP BY u.email ORDER BY u.email;
END $$;
GRANT EXECUTE ON FUNCTION public.admin_team_members() TO authenticated;
