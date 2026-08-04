-- Mobile push notifications support: device tokens + user preferences.

create table if not exists public.device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists device_tokens_user_id_idx on public.device_tokens(user_id);
create index if not exists device_tokens_last_seen_idx on public.device_tokens(last_seen_at desc);

alter table public.device_tokens enable row level security;

drop policy if exists "device_tokens_select_own" on public.device_tokens;
create policy "device_tokens_select_own"
  on public.device_tokens for select
  using (auth.uid() = user_id);

drop policy if exists "device_tokens_insert_own" on public.device_tokens;
create policy "device_tokens_insert_own"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

drop policy if exists "device_tokens_update_own" on public.device_tokens;
create policy "device_tokens_update_own"
  on public.device_tokens for update
  using (auth.uid() = user_id);

drop policy if exists "device_tokens_delete_own" on public.device_tokens;
create policy "device_tokens_delete_own"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.device_tokens to authenticated;


create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_reminder_enabled boolean not null default true,
  daily_reminder_time text not null default '19:00',
  streak_nudges boolean not null default true,
  flashcards_due boolean not null default true,
  friend_activity boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

drop policy if exists "notif_prefs_select_own" on public.notification_preferences;
create policy "notif_prefs_select_own"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

drop policy if exists "notif_prefs_upsert_own_insert" on public.notification_preferences;
create policy "notif_prefs_upsert_own_insert"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

drop policy if exists "notif_prefs_upsert_own_update" on public.notification_preferences;
create policy "notif_prefs_upsert_own_update"
  on public.notification_preferences for update
  using (auth.uid() = user_id);

grant select, insert, update on public.notification_preferences to authenticated;

create or replace function public.touch_notification_preferences()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists notification_preferences_touch on public.notification_preferences;
create trigger notification_preferences_touch
  before update on public.notification_preferences
  for each row execute function public.touch_notification_preferences();
