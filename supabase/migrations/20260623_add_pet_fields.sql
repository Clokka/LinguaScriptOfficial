alter table public.profiles
  add column if not exists pet_id   text,
  add column if not exists pet_name text;
