-- LinguaScript Stremio add-on: private cache for finished dual subtitle files.
-- One paste, safe to run again. Supabase → SQL Editor (or paste into Lovable chat).
-- Only the stremio-addon edge function (service role) reads/writes it; no
-- policies are added, so nobody else can list or download the files.
insert into storage.buckets (id, name, public)
values ('stremio-subs', 'stremio-subs', false)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
