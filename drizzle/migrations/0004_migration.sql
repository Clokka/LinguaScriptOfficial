CREATE TABLE public.experiments (
  key text PRIMARY KEY,
  name text NOT NULL,
  variants text[] NOT NULL,
  status text NOT NULL DEFAULT 'running',
  winner text,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.experiments TO anon, authenticated;
GRANT ALL ON public.experiments TO service_role;
ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read experiments" ON public.experiments FOR SELECT USING (true);
CREATE POLICY "Admins manage experiments" ON public.experiments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.experiment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_key text NOT NULL REFERENCES public.experiments(key) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  user_id uuid,
  variant text NOT NULL,
  event text NOT NULL,
  segment jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experiment_key, visitor_id, event)
);
GRANT SELECT ON public.experiment_events TO authenticated;
GRANT ALL ON public.experiment_events TO service_role;
ALTER TABLE public.experiment_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read experiment events" ON public.experiment_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Validated write path for visitors (no direct inserts).
CREATE OR REPLACE FUNCTION public.record_experiment_event(_key text, _visitor text, _variant text, _event text, _segment jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v text[];
BEGIN
  IF _event NOT IN ('view','cta','signup','first_word','upgrade') THEN RETURN; END IF;
  IF length(_visitor) < 8 OR length(_visitor) > 64 THEN RETURN; END IF;
  SELECT variants INTO v FROM experiments WHERE key = _key AND status = 'running';
  IF v IS NULL OR NOT (_variant = ANY(v)) THEN RETURN; END IF;
  INSERT INTO experiment_events(experiment_key, visitor_id, user_id, variant, event, segment)
  VALUES (_key, _visitor, auth.uid(), _variant, _event,
          CASE WHEN pg_column_size(_segment) < 2000 THEN coalesce(_segment,'{}'::jsonb) ELSE '{}'::jsonb END)
  ON CONFLICT (experiment_key, visitor_id, event) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.record_experiment_event(text,text,text,text,jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.record_experiment_event(text,text,text,text,jsonb) TO anon, authenticated;

-- Admin results: counts per variant, segment dimension and value.
CREATE OR REPLACE FUNCTION public.experiment_results(_key text, _dimension text DEFAULT 'all')
RETURNS TABLE(variant text, segment_value text, views bigint, ctas bigint, signups bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  RETURN QUERY
  SELECT e.variant,
         CASE WHEN _dimension = 'all' THEN 'all' ELSE coalesce(e.segment->>_dimension, 'unknown') END,
         count(*) FILTER (WHERE e.event = 'view'),
         count(*) FILTER (WHERE e.event = 'cta'),
         count(*) FILTER (WHERE e.event = 'signup')
  FROM experiment_events e
  WHERE e.experiment_key = _key
  GROUP BY 1, 2
  ORDER BY 2, 1;
END $$;
REVOKE ALL ON FUNCTION public.experiment_results(text,text) FROM public;
GRANT EXECUTE ON FUNCTION public.experiment_results(text,text) TO authenticated;

INSERT INTO public.experiments(key, name, variants) VALUES
  ('landing_headline', 'Landing headline: method vs anime vs exam', ARRAY['control','anime','exam']);