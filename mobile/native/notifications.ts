import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  upsertDeviceToken,
  type NotificationPreferences,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const DAILY_REMINDER_ID = 'linguascript-daily-reminder';

export async function ensurePermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function ensureAndroidChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Daily reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#22c55e',
  });
  await Notifications.setNotificationChannelAsync('streak', {
    name: 'Streak nudges',
    importance: Notifications.AndroidImportance.HIGH,
  });
  await Notifications.setNotificationChannelAsync('flashcards', {
    name: 'Flashcards due',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  await Notifications.setNotificationChannelAsync('friends', {
    name: 'Friend activity',
    importance: Notifications.AndroidImportance.LOW,
  });
}

export async function registerForPushAsync(userId: string): Promise<string | null> {
  const ok = await ensurePermissions();
  if (!ok) return null;
  await ensureAndroidChannels();
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  try {
    const token = (
      await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)
    ).data;
    if (token) {
      await upsertDeviceToken(
        supabase,
        userId,
        token,
        Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
      );
    }
    return token;
  } catch (e) {
    console.warn('getExpoPushTokenAsync failed', e);
    return null;
  }
}

/**
 * Schedule a repeating local daily reminder at HH:MM. Fires even offline.
 * Cancels any existing schedule first.
 */
export async function scheduleDailyReminder(hhmm: string): Promise<void> {
  const [hStr, mStr] = hhmm.split(':');
  const hour = Math.min(23, Math.max(0, Number(hStr)));
  const minute = Math.min(59, Math.max(0, Number(mStr)));
  await cancelDailyReminder();
  const ok = await ensurePermissions();
  if (!ok) return;
  await Notifications.scheduleNotificationAsync({
    identifier: DAILY_REMINDER_ID,
    content: {
      title: 'Chameleon is waiting 🦎',
      body: "5 minutes today keeps your streak green.",
      data: { kind: 'daily-reminder' },
      ...(Platform.OS === 'android' ? { channelId: 'reminders' } : {}),
    },
    trigger: {
      hour,
      minute,
      repeats: true,
    } as any,
  });
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_REMINDER_ID);
  } catch {}
}

export async function applyPreferences(
  userId: string,
  prefs: NotificationPreferences,
): Promise<void> {
  if (prefs.daily_reminder_enabled) {
    await scheduleDailyReminder(prefs.daily_reminder_time);
  } else {
    await cancelDailyReminder();
  }
  await registerForPushAsync(userId);
}
