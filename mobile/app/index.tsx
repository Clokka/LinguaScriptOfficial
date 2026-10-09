import { useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { createClient } from '@supabase/supabase-js';
import { registerForPushAsync } from '@/native/notifications';
import { supabase } from '@/lib/supabase';

const APP_URL = 'https://linguascript.co.uk';
const ONBOARDING_URL = 'https://linguascript.co.uk/onboarding';

// The website keeps its Supabase session in localStorage. Send its access token
// to native so the push token is saved as that user — device_tokens RLS only
// lets a signed-in user save their own row. Only the access token is used
// natively: refreshing the site's session from here too would rotate its
// refresh token and could log the website out. Polls because the site is a
// SPA: logging in there doesn't trigger a new page load, and the site's own
// refreshes give us a fresh access token.
const INJECT_SESSION_JS = `
(function() {
  if (window.__lsSessionPoll) return true;
  var lastSent = null;
  function check() {
    try {
      var raw = localStorage.getItem('sb-ffephracinqeylfhqkiz-auth-token');
      if (!raw) return;
      var parsed = JSON.parse(raw);
      var refresh = parsed && parsed.refresh_token;
      if (!refresh || refresh === lastSent) return;
      lastSent = refresh;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'session',
        userId: parsed.user && parsed.user.id,
        accessToken: parsed.access_token,
      }));
    } catch (e) {}
  }
  check();
  window.__lsSessionPoll = setInterval(check, 5000);
  true;
})();
`;

export default function AppScreen() {
  const webRef = useRef<WebView>(null);
  const [registered, setRegistered] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [startUrl, setStartUrl] = useState<string | null>(null);

  // Determine start URL — onboarding for first-time users, home for returning
  useEffect(() => {
    async function resolveStartUrl() {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) { setStartUrl(APP_URL); return; }

      const key = `onboarded:${uid}`;
      const seen = await AsyncStorage.getItem(key);
      if (!seen) {
        await AsyncStorage.setItem(key, '1');
        setStartUrl(ONBOARDING_URL);
      } else {
        setStartUrl(APP_URL);
      }
    }
    resolveStartUrl();
  }, []);

  // Register push token once we have a userId
  useEffect(() => {
    if (!userId || registered) return;
    setRegistered(true);
    registerForPushAsync(userId);
  }, [userId, registered]);

  // Handle push notification taps → navigate inside the WebView
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      let path = '/';
      if (data?.kind === 'flashcards-due') path = '/flashcards';
      else if (data?.kind === 'streak-nudge') path = '/';
      else if (data?.kind === 'friend-activity') path = '/friends';
      webRef.current?.injectJavaScript(`window.location.href = '${APP_URL}${path}'; true;`);
    });
    return () => sub.remove();
  }, []);

  // Also try to get session from Supabase directly (for cases where user logged in via the app)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) setUserId(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user?.id) setUserId(session.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!startUrl) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#22c55e" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <WebView
        ref={webRef}
        source={{ uri: startUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        // Inject JS after each page load to extract the logged-in user
        injectedJavaScriptForMainFrameOnly
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly={false}
        onLoadEnd={() => {
          webRef.current?.injectJavaScript(INJECT_SESSION_JS);
        }}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'session' && msg.userId && msg.accessToken) {
              const webClient = createClient(
                process.env.EXPO_PUBLIC_SUPABASE_URL!,
                process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
                {
                  auth: { persistSession: false, autoRefreshToken: false },
                  global: { headers: { Authorization: `Bearer ${msg.accessToken}` } },
                },
              );
              registerForPushAsync(msg.userId, webClient);
            }
          } catch (_) {}
        }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator color="#22c55e" size="large" />
          </View>
        )}
        startInLoadingState
        // Allow all navigation within linguascript.co.uk
        onShouldStartLoadWithRequest={(req) => {
          if (req.url.startsWith('https://linguascript.co.uk')) return true;
          if (req.url.startsWith('http://localhost')) return true;
          return true;
        }}
        // User agent hint so the site knows it's inside the app
        applicationNameForUserAgent="LinguaScriptApp/1.0"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0b1215' },
  webview: { flex: 1 },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1215' },
});
