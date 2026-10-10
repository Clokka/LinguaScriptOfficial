import '../global.css';
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { ensureAndroidChannels } from '@/native/notifications';

try { WebBrowser.maybeCompleteAuthSession(); } catch (_) {}

// The app is a wrapper around linguascript.co.uk (app/index.tsx): the website
// owns sign-in, onboarding and every screen, so there is no native routing
// here. The native screens (auth, tour, onboarding, tabs) are kept in the
// codebase but are no longer navigated to.
export default function RootLayout() {
  useEffect(() => {
    ensureAndroidChannels();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
