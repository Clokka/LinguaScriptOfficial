import '../global.css';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    ensureAndroidChannels();
  }, []);

  useEffect(() => {
    // Safety net — if Supabase never responds, go to auth after 4 seconds
    const timeout = setTimeout(() => { setSession(null); setReady(true); }, 4000);

    supabase.auth.getSession().then(({ data }) => {
      clearTimeout(timeout);
      setSession(data.session ?? null);
      setReady(true);
    }).catch(() => {
      clearTimeout(timeout);
      setSession(null);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!ready || session === undefined) return;

    const inAuth = segments[0] === 'auth';
    const inTour = segments[0] === 'tour';

    if (session) {
      // Logged in — go to app
      if (inAuth || inTour) router.replace('/');
      return;
    }

    // Not logged in — show tour first, then auth
    if (!inTour && !inAuth) {
      AsyncStorage.getItem('tour_seen').then((seen) => {
        if (seen) {
          router.replace('/auth');
        } else {
          router.replace('/tour');
        }
      });
    }
  }, [ready, session, segments]);

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
