import { useCallback, useEffect, useRef, useState } from 'react';
import { View, ActivityIndicator, StyleSheet, BackHandler, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { createClient } from '@supabase/supabase-js';
import { registerForPushAsync } from '@/native/notifications';

const APP_URL = 'https://linguascript.co.uk';
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const AUTH_CALLBACK = 'linguascript://auth-callback';

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

// https://linguascript.co.uk/gift/X style links open that page in the app.
function siteUrlFromLink(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith(APP_URL) ? url : null;
}

export default function AppScreen() {
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [startUrl, setStartUrl] = useState<string | null>(null);

  const goTo = useCallback((url: string) => {
    webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => setStartUrl(siteUrlFromLink(url) ?? APP_URL));
    const sub = Linking.addEventListener('url', ({ url }) => {
      const site = siteUrlFromLink(url);
      if (site) goTo(site);
    });
    return () => sub.remove();
  }, [goTo]);

  // Android back button goes back a page in the site instead of closing the app.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false;
      webRef.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, []);

  // Push notification taps → open the matching page.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      let path = '/';
      if (data?.kind === 'flashcards-due') path = '/flashcards';
      else if (data?.kind === 'friend-activity') path = '/friends';
      goTo(`${APP_URL}${path}`);
    });
    return () => sub.remove();
  }, [goTo]);

  // Google refuses to show its sign-in page inside an embedded WebView
  // (403 disallowed_useragent). When the site starts Google OAuth, run it in
  // a Chrome Custom Tab that returns to the app, then hand the result back to
  // the site as if Google had redirected there — the site's Supabase client
  // reads the session from the URL (#access_token=… or ?code=…).
  const signInWithGoogle = useCallback(async (authorizeUrl: string) => {
    const url = new URL(authorizeUrl);
    const original = url.searchParams.get('redirect_to') ?? '';
    const back = original.startsWith(APP_URL) ? original : `${APP_URL}/`;
    url.searchParams.set('redirect_to', AUTH_CALLBACK);
    const result = await WebBrowser.openAuthSessionAsync(url.toString(), AUTH_CALLBACK);
    if (result.type !== 'success') return;
    // Whatever Supabase appended (?code=… and/or #access_token=…).
    const rest = result.url.slice(AUTH_CALLBACK.length).replace(/^\//, '');
    if (rest.startsWith('?')) {
      goTo(back + (back.includes('?') ? '&' : '?') + rest.slice(1));
    } else {
      goTo(back.split('#')[0] + rest);
    }
  }, [goTo]);

  const onShouldStartLoadWithRequest = useCallback((req: WebViewNavigation) => {
    if (req.url.startsWith(`${SUPABASE_URL}/auth/v1/authorize`) && req.url.includes('provider=google')) {
      signInWithGoogle(req.url);
      return false;
    }
    return true;
  }, [signInWithGoogle]);

  if (!startUrl) {
    return <View style={styles.loading}><ActivityIndicator color="#22c55e" size="large" /></View>;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <WebView
        ref={webRef}
        source={{ uri: startUrl }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        allowsBackForwardNavigationGestures
        mediaPlaybackRequiresUserAction={false}
        onLoadEnd={() => webRef.current?.injectJavaScript(INJECT_SESSION_JS)}
        onNavigationStateChange={(nav) => { canGoBack.current = nav.canGoBack; }}
        onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'session' && msg.userId && msg.accessToken) {
              const webClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: { persistSession: false, autoRefreshToken: false },
                global: { headers: { Authorization: `Bearer ${msg.accessToken}` } },
              });
              registerForPushAsync(msg.userId, webClient);
            }
          } catch (_) {}
        }}
        renderLoading={() => (
          <View style={styles.loading}><ActivityIndicator color="#22c55e" size="large" /></View>
        )}
        startInLoadingState
        // User agent hint so the site knows it's inside the app
        applicationNameForUserAgent="LinguaScriptApp/1.0"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0b1215' },
  webview: { flex: 1, backgroundColor: '#0b1215' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1215' },
});
