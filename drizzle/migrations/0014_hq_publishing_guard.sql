CREATE OR REPLACE FUNCTION public.valid_site_page(_page jsonb)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
BEGIN
 IF jsonb_typeof(_page) <> 'object' THEN RETURN false; END IF;
 IF _page->>'kind'='react' THEN RETURN coalesce(_page->>'page' IN ('current','gold','glass','split','clear','landing','v2','v3','v4'),false); END IF;
 IF _page->>'kind'='studio' THEN
 IF jsonb_typeof(_page->'sections') <> 'array' THEN RETURN false; END IF;
 RETURN jsonb_typeof(_page->'theme')='string' AND jsonb_array_length(_page->'sections') <= 40;
 END IF;
 RETURN false;
END $$;
CREATE OR REPLACE FUNCTION public.publish_site(_config jsonb, _note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _id bigint; _key text; _arms text[]; _home jsonb; arm jsonb;
BEGIN
 IF NOT public.is_site_team(auth.uid()) THEN RAISE EXCEPTION 'Only the LinguaScript team can publish'; END IF;
 IF jsonb_typeof(_config) <> 'object' OR coalesce(_config->>'version','') <> '2' THEN RAISE EXCEPTION 'Unknown config version'; END IF;
 _home := _config->'home';
 IF jsonb_typeof(_home) IS DISTINCT FROM 'object' OR coalesce(_home->>'mode','') NOT IN ('builtin','single','test') THEN RAISE EXCEPTION 'Choose a valid homepage setup.'; END IF;
 IF _home->>'mode'='single' AND NOT public.valid_site_page(_home->'page') THEN RAISE EXCEPTION 'Choose a valid homepage.'; END IF;
 IF _home->>'mode'='test' THEN
 _key := _home->>'key';
 IF coalesce(_key,'') !~ '^[a-z0-9_]{3,40}$' OR jsonb_typeof(_home->'arms') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose a valid test key and versions.'; END IF;
 IF jsonb_array_length(_home->'arms') NOT BETWEEN 2 AND 4 THEN RAISE EXCEPTION 'Choose between two and four test versions.'; END IF;
 FOR arm IN SELECT value FROM jsonb_array_elements(_home->'arms') LOOP
 IF coalesce(arm->>'id','') !~ '^[a-z0-9]{1,12}$' OR NOT public.valid_site_page(arm->'page') THEN RAISE EXCEPTION 'A test version is invalid.'; END IF;
 END LOOP;
 SELECT array_agg(a->>'id') INTO _arms FROM jsonb_array_elements(_home->'arms') a;
 IF (SELECT count(DISTINCT id) FROM unnest(_arms) id) <> array_length(_arms,1) THEN RAISE EXCEPTION 'Test versions need unique identifiers.'; END IF;
 INSERT INTO public.experiments(key,name,variants,status) VALUES(_key,'Homepage test (from HQ)',_arms,'running') ON CONFLICT(key) DO UPDATE SET variants=EXCLUDED.variants,status='running';
 END IF;
 INSERT INTO public.site_publishes(config,note,published_by) VALUES(_config-'published_id'-'published_at',left(_note,200),auth.uid()) RETURNING id INTO _id;
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.publish_site(jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_site(jsonb,text) TO authenticated,service_role;