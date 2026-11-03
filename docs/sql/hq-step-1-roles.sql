-- STEP 1 of 2 — paste into Supabase SQL Editor (or Lovable) and press Run.
-- Adds the new team roles. Must run on its own before step 2.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'engineer';
