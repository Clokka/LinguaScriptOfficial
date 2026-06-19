ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS interests TEXT[] NOT NULL DEFAULT '{}'::text[];