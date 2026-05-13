ALTER TABLE public.catalog_rows
  ADD COLUMN IF NOT EXISTS language text;

CREATE INDEX IF NOT EXISTS idx_catalog_rows_language ON public.catalog_rows (language);