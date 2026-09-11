-- Security fix: catalog_rows/catalog_row_films (the home page's curated
-- rails) had INSERT/UPDATE/DELETE policies checking only `WITH CHECK (true)`
-- for any authenticated user — not an admin check — so any signed-up user
-- could add, reorder, or delete the curated home page content. Likewise,
-- films' INSERT policy only checked `auth.uid() IS NOT NULL`, with no
-- constraint on `is_public` or `created_by`, so any user could publish a
-- film directly (is_public = true) or insert with created_by = NULL, which
-- the existing UPDATE/DELETE policies' `OR created_by IS NULL` clause then
-- let ANY other authenticated user edit or delete.
--
-- IMPORTANT: this requires at least one row in public.user_roles with
-- role = 'admin' for the account that manages /admin — has_role() returning
-- false for everyone locks the Admin catalog-editing UI for everyone,
-- including legitimate admins, until such a row exists.

-- catalog_rows: admin-only writes.
DROP POLICY IF EXISTS "Authenticated can manage catalog rows insert" ON public.catalog_rows;
DROP POLICY IF EXISTS "Authenticated can manage catalog rows update" ON public.catalog_rows;
DROP POLICY IF EXISTS "Authenticated can manage catalog rows delete" ON public.catalog_rows;

CREATE POLICY "Admins can insert catalog rows"
  ON public.catalog_rows FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update catalog rows"
  ON public.catalog_rows FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete catalog rows"
  ON public.catalog_rows FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- catalog_row_films: same.
DROP POLICY IF EXISTS "Authenticated can manage catalog row films insert" ON public.catalog_row_films;
DROP POLICY IF EXISTS "Authenticated can manage catalog row films update" ON public.catalog_row_films;
DROP POLICY IF EXISTS "Authenticated can manage catalog row films delete" ON public.catalog_row_films;

CREATE POLICY "Admins can insert catalog row films"
  ON public.catalog_row_films FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update catalog row films"
  ON public.catalog_row_films FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete catalog row films"
  ON public.catalog_row_films FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- films: a regular user may still insert/manage their own PRIVATE lesson
-- (the "paste a YouTube link" feature depends on this), but never publish
-- one directly, claim an orphaned row, or touch someone else's film.
-- Admins can do all of the above, for catalog curation.
DROP POLICY IF EXISTS "Authenticated users can insert films" ON public.films;
CREATE POLICY "Users insert their own private films, admins any"
  ON public.films FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (created_by = auth.uid() AND is_public = false)
  );

DROP POLICY IF EXISTS "Owners can update their films" ON public.films;
CREATE POLICY "Owners update their films, admins any"
  ON public.films FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (auth.uid() = created_by AND is_public = false)
  );

DROP POLICY IF EXISTS "Owners can delete their films" ON public.films;
CREATE POLICY "Owners delete their films, admins any"
  ON public.films FOR DELETE TO authenticated
  USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
