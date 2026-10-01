CREATE OR REPLACE FUNCTION public.admin_fill_vocab_translations(_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.core_vocabulary cv SET translation = left(trim(r.t), 120)
    FROM jsonb_to_recordset(_rows) AS r(id uuid, t text)
   WHERE cv.id = r.id AND coalesce(cv.translation,'') = '' AND coalesce(trim(r.t),'') <> '';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.admin_fill_vocab_translations(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_fill_vocab_translations(jsonb) TO authenticated;