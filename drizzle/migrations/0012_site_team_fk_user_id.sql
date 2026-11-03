ALTER TABLE public.site_drafts DROP CONSTRAINT IF EXISTS site_drafts_updated_by_fkey;
ALTER TABLE public.site_drafts ADD CONSTRAINT site_drafts_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;
ALTER TABLE public.site_publishes DROP CONSTRAINT IF EXISTS site_publishes_published_by_fkey;
ALTER TABLE public.site_publishes ADD CONSTRAINT site_publishes_published_by_fkey
  FOREIGN KEY (published_by) REFERENCES public.profiles(user_id) ON DELETE SET NULL;