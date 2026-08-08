import type { LinguaScriptSupabaseClient } from './supabase';

export type NotificationPlatform = 'ios' | 'android' | 'web';

export interface NotificationPreferences {
  user_id: string;
  daily_reminder_enabled: boolean;
  daily_reminder_time: string;
  streak_nudges: boolean;
  flashcards_due: boolean;
  friend_activity: boolean;
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'user_id'> = {
  daily_reminder_enabled: true,
  daily_reminder_time: '19:00',
  streak_nudges: true,
  flashcards_due: true,
  friend_activity: true,
};

export async function upsertDeviceToken(
  client: LinguaScriptSupabaseClient,
  userId: string,
  token: string,
  platform: NotificationPlatform,
): Promise<void> {
  const { error } = await (client as any)
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        expo_push_token: token,
        platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'expo_push_token' },
    );
  if (error) console.error('upsertDeviceToken', error);
}

export async function removeDeviceToken(
  client: LinguaScriptSupabaseClient,
  token: string,
): Promise<void> {
  const { error } = await (client as any)
    .from('device_tokens')
    .delete()
    .eq('expo_push_token', token);
  if (error) console.error('removeDeviceToken', error);
}

export async function fetchNotificationPreferences(
  client: LinguaScriptSupabaseClient,
  userId: string,
): Promise<NotificationPreferences> {
  const { data } = await (client as any)
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (!data) return { user_id: userId, ...DEFAULT_PREFERENCES };
  return data as NotificationPreferences;
}

export async function saveNotificationPreferences(
  client: LinguaScriptSupabaseClient,
  prefs: NotificationPreferences,
): Promise<void> {
  const { error } = await (client as any)
    .from('notification_preferences')
    .upsert(prefs, { onConflict: 'user_id' });
  if (error) console.error('saveNotificationPreferences', error);
}
