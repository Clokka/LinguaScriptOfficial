-- LinguaScript HQ, part 1: the "engineer" role (AI / software engineers).
-- Own migration: Postgres can't use a new enum value in the transaction that adds it.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'engineer';
