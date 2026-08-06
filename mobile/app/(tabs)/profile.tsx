import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Switch,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  fetchProfile,
  fetchNotificationPreferences,
  saveNotificationPreferences,
  LANGUAGES,
  updateActiveLanguage,
  type Profile,
  type NotificationPreferences,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { TimePicker } from '@/components/TimePicker';
import { tapLight, selection, success as hapticSuccess } from '@/native/haptics';
import { shareFriendInvite } from '@/native/share';
import { applyPreferences, registerForPushAsync } from '@/native/notifications';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingLang, setSavingLang] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [p, np] = await Promise.all([
      fetchProfile(supabase, user.id),
      fetchNotificationPreferences(supabase, user.id),
    ]);
    setProfile(p);
    setPrefs(np);
    setLoading(false);
    // Register for push on first entry.
    registerForPushAsync(user.id);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePref = async <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => {
    if (!prefs || !user) return;
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    selection();
    await saveNotificationPreferences(supabase, next);
    await applyPreferences(user.id, next);
    hapticSuccess();
  };

  const changeLang = async (code: string) => {
    if (!user) return;
    setSavingLang(true);
    tapLight();
    await updateActiveLanguage(supabase, user.id, code);
    const p = await fetchProfile(supabase, user.id);
    setProfile(p);
    setSavingLang(false);
    hapticSuccess();
  };

  if (loading || !profile || !prefs) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="items-center pt-4 pb-6">
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={{ width: 96, height: 96, borderRadius: 48 }}
            />
          ) : (
            <Image
              source={require('../../assets/images/chameleon-glow.png')}
              style={{ width: 120, height: 120 }}
              resizeMode="contain"
            />
          )}
          <Text className="text-white text-xl font-bold mt-3">
            {profile.display_name ?? profile.username ?? 'Learner'}
          </Text>
          <Text className="text-slate-400 mt-1">{user?.email}</Text>

          <View className="flex-row mt-5 gap-6">
            <View className="items-center">
              <Text className="text-2xl">🔥</Text>
              <Text className="text-white font-semibold text-lg">
                {profile.streak_count ?? 0}
              </Text>
              <Text className="text-slate-500 text-xs">Streak</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl">⭐</Text>
              <Text className="text-white font-semibold text-lg">
                {profile.xp_total ?? 0}
              </Text>
              <Text className="text-slate-500 text-xs">XP</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl">🏆</Text>
              <Text className="text-white font-semibold text-lg">
                {profile.xp_level ?? 1}
              </Text>
              <Text className="text-slate-500 text-xs">Level</Text>
            </View>
          </View>
        </View>

        <View className="mx-4 bg-ink-card border border-ink-border rounded-2xl p-4">
          <Text className="text-white text-lg font-semibold">Learning language</Text>
          <Text className="text-slate-400 text-xs mt-1">
            Active: {profile.learning_language ?? '—'}
          </Text>
          <ScrollView horizontal className="mt-3" showsHorizontalScrollIndicator={false}>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => changeLang(l.code)}
                disabled={savingLang}
                className="mr-2 px-3 py-2 rounded-full border"
                style={{
                  backgroundColor:
                    profile.learning_language === l.code ? '#22c55e' : 'transparent',
                  borderColor: profile.learning_language === l.code ? '#22c55e' : '#243239',
                }}
              >
                <Text
                  style={{
                    color: profile.learning_language === l.code ? '#0b1215' : '#e2e8f0',
                    fontWeight: '600',
                  }}
                >
                  {l.flag} {l.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="mx-4 mt-4 bg-ink-card border border-ink-border rounded-2xl p-4">
          <Text className="text-white text-lg font-semibold mb-3">Notifications</Text>

          <View className="flex-row items-center justify-between py-2">
            <View className="flex-1 pr-3">
              <Text className="text-white">Daily reminder</Text>
              <Text className="text-slate-500 text-xs mt-0.5">
                Local nudge to keep your streak — fires even offline.
              </Text>
            </View>
            <Switch
              value={prefs.daily_reminder_enabled}
              onValueChange={(v) => updatePref('daily_reminder_enabled', v)}
              trackColor={{ true: '#22c55e', false: '#334155' }}
              thumbColor="#f8fafc"
            />
          </View>

          {prefs.daily_reminder_enabled && (
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-white">Reminder time</Text>
              <TimePicker
                value={prefs.daily_reminder_time}
                onChange={(t) => updatePref('daily_reminder_time', t)}
              />
            </View>
          )}

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-white">Streak-save nudges</Text>
            <Switch
              value={prefs.streak_nudges}
              onValueChange={(v) => updatePref('streak_nudges', v)}
              trackColor={{ true: '#22c55e', false: '#334155' }}
              thumbColor="#f8fafc"
            />
          </View>

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-white">Flashcards due</Text>
            <Switch
              value={prefs.flashcards_due}
              onValueChange={(v) => updatePref('flashcards_due', v)}
              trackColor={{ true: '#22c55e', false: '#334155' }}
              thumbColor="#f8fafc"
            />
          </View>

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-white">Friend activity</Text>
            <Switch
              value={prefs.friend_activity}
              onValueChange={(v) => updatePref('friend_activity', v)}
              trackColor={{ true: '#22c55e', false: '#334155' }}
              thumbColor="#f8fafc"
            />
          </View>
        </View>

        {profile.friend_code && (
          <View className="mx-4 mt-4 bg-ink-card border border-ink-border rounded-2xl p-4">
            <Text className="text-white text-lg font-semibold">Invite a friend</Text>
            <Text className="text-slate-500 text-xs mt-1">
              Your friend code: {profile.friend_code}
            </Text>
            <Pressable
              onPress={() => shareFriendInvite(profile.friend_code!)}
              className="bg-chameleon rounded-2xl py-3 items-center mt-3"
            >
              <Text className="text-ink font-semibold">Share invite link</Text>
            </Pressable>
          </View>
        )}

        <Pressable
          onPress={() => {
            Alert.alert('Log out', 'Sign out of LinguaScript?', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Log out',
                style: 'destructive',
                onPress: () => signOut(),
              },
            ]);
          }}
          className="mx-4 mt-6 bg-ink-card border border-ink-border rounded-2xl py-4 items-center"
        >
          <Text className="text-red-400 font-semibold">Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
