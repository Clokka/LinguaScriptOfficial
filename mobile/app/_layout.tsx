import '../global.css';
import { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, Animated } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
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

  useEffect(() => {
    if (loading) return;
    const first = segments[0];
    const inAuth = first === 'auth';
    if (!session && !inAuth) router.replace('/auth');
    else if (session && inAuth) router.replace('/(tabs)');
  }, [session, loading, segments]);

  return null;
}

function LinkListener() {
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      const data = resp.notification.request.content.data as any;
      if (data?.kind === 'flashcards-due') {
        // handled by router in specific screens
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

function AppShell() {
  const { loading } = useAuth();
  if (loading) return <WelcomeSplash />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: UI.bg } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
    </Stack>
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
          <AuthGate />
          <LinkListener />
          <AppShell />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
