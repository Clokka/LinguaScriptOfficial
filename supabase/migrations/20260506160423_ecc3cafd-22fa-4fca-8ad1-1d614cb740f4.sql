
-- films: add ownership + visibility
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.films ADD COLUMN IF NOT EXISTS created_by uuid;

-- Backfill: mark all existing as private. Admin will re-publish curated ones.
UPDATE public.films SET is_public = false WHERE is_public IS NULL OR is_public = true;

-- Replace permissive films policies
DROP POLICY IF EXISTS "Anyone can view films" ON public.films;
DROP POLICY IF EXISTS "Anyone can insert films" ON public.films;
DROP POLICY IF EXISTS "Anyone can delete films" ON public.films;

CREATE POLICY "Public films are viewable by everyone"
  ON public.films FOR SELECT
  USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Authenticated users can insert films"
  ON public.films FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Owners can update their films"
  ON public.films FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR created_by IS NULL);

CREATE POLICY "Owners can delete their films"
  ON public.films FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR created_by IS NULL);

-- catalog_rows
CREATE TABLE public.catalog_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalog_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view catalog rows"
  ON public.catalog_rows FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage catalog rows insert"
  ON public.catalog_rows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can manage catalog rows update"
  ON public.catalog_rows FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can manage catalog rows delete"
  ON public.catalog_rows FOR DELETE TO authenticated USING (true);

-- catalog_row_films
CREATE TABLE public.catalog_row_films (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.catalog_rows(id) ON DELETE CASCADE,
  film_id uuid NOT NULL REFERENCES public.films(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (row_id, film_id)
);
ALTER TABLE public.catalog_row_films ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view catalog row films"
  ON public.catalog_row_films FOR SELECT USING (true);
CREATE POLICY "Authenticated can manage catalog row films insert"
  ON public.catalog_row_films FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can manage catalog row films update"
  ON public.catalog_row_films FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can manage catalog row films delete"
  ON public.catalog_row_films FOR DELETE TO authenticated USING (true);
