import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { configureGoogleSignIn } from '@/native/google-signin';
import { ensureAndroidChannels } from '@/native/notifications';
import { handleDeepLink } from '@/native/deep-links';
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
    const inAuth = segments[0] === 'auth';
    if (!session && !inAuth) router.replace('/auth');
    else if (session && inAuth) router.replace('/(tabs)');
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
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0b1215' } }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="auth" />
          </Stack>
          <AuthGate />
          <LinkListener />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
