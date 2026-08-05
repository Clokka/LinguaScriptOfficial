import type { LinguaScriptSupabaseClient } from './supabase';

export interface Profile {
  id: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  learning_language?: string | null;
  native_language?: string | null;
  cef_level?: string | null;
  xp_total?: number | null;
  xp_level?: number | null;
  streak_count?: number | null;
  daily_word_goal?: number | null;
  daily_video_goal?: number | null;
  friend_code?: string | null;
  is_pro?: boolean | null;
}

export async function fetchProfile(
  client: LinguaScriptSupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await client
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, learning_language, native_language, cef_level, xp_total, xp_level, streak_count, daily_word_goal, daily_video_goal, friend_code, is_pro',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.error('fetchProfile', error);
    return null;
  }
  return (data as unknown as Profile) ?? null;
}

export async function updateLearningLanguage(
  client: LinguaScriptSupabaseClient,
  userId: string,
  language: string,
): Promise<void> {
  const { error } = await client
    .from('profiles')
    .update({ learning_language: language })
    .eq('id', userId);
  if (error) console.error('updateLearningLanguage', error);
}

// Backwards-compatible alias — the mobile UI reads "active language"
// as a friendlier concept, but it maps to the same column.
export const updateActiveLanguage = updateLearningLanguage;
