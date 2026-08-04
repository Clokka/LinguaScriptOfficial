import type { LinguaScriptSupabaseClient } from './supabase';

export interface Profile {
  id: string;
  email?: string | null;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  active_language?: string | null;
  native_language?: string | null;
  cefr_level?: string | null;
  xp_total?: number | null;
  current_streak?: number | null;
  longest_streak?: number | null;
  daily_goal?: number | null;
  friend_code?: string | null;
}

export async function fetchProfile(
  client: LinguaScriptSupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, email, username, display_name, avatar_url, active_language, native_language, cefr_level, xp_total, current_streak, longest_streak, daily_goal, friend_code',
    )
    .eq('id', userId)
    .single();
  if (error) {
    console.error('fetchProfile', error);
    return null;
  }
  return data as Profile;
}

export async function updateActiveLanguage(
  client: LinguaScriptSupabaseClient,
  userId: string,
  language: string,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ active_language: language })
    .eq('id', userId);
  if (error) console.error('updateActiveLanguage', error);
}
