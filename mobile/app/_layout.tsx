import '../global.css';
import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { configureGoogleSignIn } from '@/native/google-signin';
import { ensureAndroidChannels } from '@/native/notifications';
import { handleDeepLink } from '@/native/deep-links';
import { DECK, UI } from '@/lib/deck-colors';
import * as Linking from 'expo-linking';

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Wait until the navigator tree is fully mounted before redirecting.
  // Without this check router.replace fires into an uninitialized navigator
  // and silently fails — leaving the user on a blank screen forever.
  const navState = useRootNavigationState();

  useEffect(() => {
    if (loading) return;
    if (!navState?.key) return; // navigator not ready yet
    const inAuth       = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    // TODO: re-enable auth gate once sign-in is working
    // if (!session && !inAuth) {
    //   router.replace('/auth');
    // } else if (session && inAuth) {
    if (session && inAuth) {
      // Just signed in → onboarding checks language and self-redirects to tabs if set.
      router.replace('/onboarding');
    }
    // } else if (!session && inOnboarding) {
    //   router.replace('/auth');
    // }
  }, [session, loading, segments, navState?.key]);

  return null;
}

function LinkListener() {
  useEffect(() => {
    Linking.getInitialURL().then((url) => { if (url) handleDeepLink(url); });
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as Record<string, unknown>;
      if (data?.kind === 'flashcards-due') {
        // Deep-link handled inside the review tab
      }
    });
    return () => sub.remove();
  }, []);
  return null;
}

/**
 * Welcome / loading screen.
 *
 * Shows the real chameleon — a render of the same GLB the pet system and
 * /landingpage4 use (public/pets/Chameleon_Animations.glb), captured to a
 * transparent PNG rather than shipped as a live model: rendering GLB in React
 * Native needs expo-gl + expo-three, which are native modules and would mean
 * another round of EAS build risk for a screen that shows for ~1 second.
 *
 * It breathes gently so the screen doesn't read as frozen while auth resolves.
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
      style={{
        flex: 1,
        backgroundColor: UI.bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Animated.Image
        source={require('../assets/images/chameleon-3d.png')}
        style={{ width: 220, height: 220, transform: [{ translateY }] }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 14 }}>
        <Text style={{ color: UI.text }}>Lingua</Text>
        <Text style={{ color: DECK.green }}>Script</Text>
      </Text>
      <ActivityIndicator color={DECK.green} size="large" style={{ marginTop: 28 }} />
    </View>
  );
}

/**
 * Draws the splash *over* the navigator rather than instead of it.
 *
 * The Stack now mounts unconditionally so it exists when AuthGate first fires
 * — gating it behind `loading` is what left users on a blank screen forever.
 * Overlaying keeps that fix intact while still showing the chameleon.
 */
function SplashOverlay() {
  const { loading } = useAuth();
  if (!loading) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WelcomeSplash />
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    configureGoogleSignIn();
    ensureAndroidChannels();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          {/* Stack always renders so the navigator exists when AuthGate first fires */}
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: UI.bg } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="onboarding" />
          </Stack>
          <SplashOverlay />
          <AuthGate />
          <LinkListener />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
