-- Partner programme, part 1: two new roles.
-- Kept in its own migration because Postgres can't use a new enum value in
-- the same transaction that adds it.
--   marketer = LinguaScript marketing team (sees all partners, no learner data)
--   partner  = affiliate (sees only their own totals)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'partner';
