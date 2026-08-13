import '../global.css';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import { ensureAndroidChannels } from '@/native/notifications';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

try { WebBrowser.maybeCompleteAuthSession(); } catch (_) {}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    ensureAndroidChannels();
  }, []);

  useEffect(() => {
    // Safety net — if Supabase never responds, go to auth after 4 seconds
    const timeout = setTimeout(() => setSession(null), 4000);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      setSession(data.session ?? null);
    }).catch(() => {
      clearTimeout(timeout);
      setSession(null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (session === undefined) return;

    const inAuth = segments[0] === 'auth';

    if (!session && !inAuth) {
      router.replace('/auth');
    } else if (session && inAuth) {
      router.replace('/');
    }
  }, [session, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
        {session === undefined && (
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: '#0b1215' }]} pointerEvents="none" />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
