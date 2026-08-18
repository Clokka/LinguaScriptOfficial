import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureAndroidChannels, registerForPushAsync } from '@/native/notifications';
import { supabase } from '@/lib/supabase';
import { AuthProvider } from '@/lib/auth-context';
import type { Session } from '@supabase/supabase-js';
import { DECK, UI } from '@/lib/deck-colors';

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

// Handle linguascript://auth-callback URLs — called both on cold start and
// while the app is foregrounded (e.g. from Chrome Custom Tab or email link).
async function handleAuthUrl(url: string) {
  if (!url.includes('auth-callback')) return;

  // Normalise: swap custom scheme so URL is parseable by the URL constructor
  const parseable = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, 'https://x/');
  const parsed = new URL(parseable);

  // PKCE (Google OAuth): code in query params
  const code = parsed.searchParams.get('code');
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
    return;
  }

  // Email magic-link: token_hash + type in query params
  const tokenHash = parsed.searchParams.get('token_hash');
  const type = parsed.searchParams.get('type') as 'email' | 'signup' | 'recovery' | null;
  if (tokenHash && type) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return;
  }

  // Implicit (rare): tokens in URL fragment
  const fragment = url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    await supabase.auth.setSession({ access_token, refresh_token });
  }
}

/**
 * Welcome screen shown while the session resolves.
 *
 * The chameleon is a render of public/pets/Chameleon_Animations.glb — the same
 * model the pet system and the web landing pages use — captured to a
 * transparent PNG. It ships as an image rather than a live model because GLB
 * in React Native needs expo-gl + expo-three, and native modules are a poor
 * trade for a screen that shows for about a second.
 *
 * Overlays the always-mounted Stack rather than replacing it, so the navigator
 * still exists when the routing effect first fires.
 */
function WelcomeSplash() {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        { backgroundColor: UI.bg, alignItems: 'center', justifyContent: 'center' },
      ]}
      pointerEvents="none"
    >
      <Animated.Image
        source={require('../assets/images/chameleon-3d.png')}
        style={{ width: 200, height: 200, transform: [{ translateY }] }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 12 }}>
        <Text style={{ color: UI.text }}>Lingua</Text>
        <Text style={{ color: DECK.green }}>Script</Text>
      </Text>
      <ActivityIndicator color={DECK.green} size="large" style={{ marginTop: 26 }} />
    </View>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    ensureAndroidChannels();
  }, []);

  // Global deep-link listener — catches auth callbacks from Chrome Custom Tab
  // and email magic-links even when the Custom Tab doesn't close cleanly.
  useEffect(() => {
    // Handle the URL the app was opened with (cold start from deep link)
    Linking.getInitialURL().then((url) => {
      if (url) handleAuthUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => handleAuthUrl(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
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

  // Register push token once a real (non-anonymous) session is available
  useEffect(() => {
    if (session?.user && !session.user.is_anonymous) {
      registerForPushAsync(session.user.id);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    if (!ready || session === undefined) return;

    const inAuth = segments[0] === 'auth';
    const inTour = segments[0] === 'tour';

    if (session) {
      if (inAuth || inTour) router.replace('/onboarding');
      return;
    }

    if (!inTour && !inAuth) {
      AsyncStorage.getItem('tour_seen').then((seen) => {
        router.replace(seen ? '/auth' : '/tour');
      });
    }
  }, [ready, session, segments]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }} />
          {session === undefined && <WelcomeSplash />}
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
