import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, BackHandler, Platform, AppState } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';
import * as Notifications from 'expo-notifications';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { createClient } from '@supabase/supabase-js';
import { ensurePermissions, registerForPushAsync } from '@/native/notifications';

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

// Supabase's ?code=… / #access_token=… from a Google sign-in redirect, or null
// for any other link. Handles "linguascript://auth-callback" and the
// "linguascript:///auth-callback" form.
function authCallbackParams(url: string): string | null {
  const m = url.match(/^linguascript:\/\/\/?auth-callback\/?(.*)$/);
  return m ? m[1] : null;
}

// https://linguascript.co.uk/gift/X style links open that page in the app.
// A Google sign-in redirect that arrives when the app was closed in the
// meantime (Android can kill it behind the Chrome tab) is handed to the site,
// whose Supabase client finishes the sign-in from the URL.
function siteUrlFromLink(url: string | null): string | null {
  if (!url) return null;
  const auth = authCallbackParams(url);
  if (auth) return `${APP_URL}/${auth}`;
  // linguascript://open/flashcards — the home-screen widget and the gold-word card.
  const open = url.match(/^linguascript:\/\/\/?open\/?(.*)$/);
  if (open) return `${APP_URL}/${open[1]}`;
  return url.startsWith(APP_URL) ? url : null;
}

// "Select text → LinguaScript" (plugins/withProcessText.js) queues words here;
// the site saves them (src/components/AppInbox.tsx). ls-config.json tells the
// native card which languages you learn / speak.
const INBOX = `${FileSystem.documentDirectory}ls-inbox.json`;
const CONFIG = `${FileSystem.documentDirectory}ls-config.json`;
const DECK = `${FileSystem.documentDirectory}ls-deck.json`;

async function readInbox(): Promise<{ at: number }[]> {
  try {
    const info = await FileSystem.getInfoAsync(INBOX);
    if (!info.exists) return [];
    const list = JSON.parse(await FileSystem.readAsStringAsync(INBOX));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

async function removeFromInbox(ats: number[]) {
  const keep = (await readInbox()).filter((i) => !ats.includes(i.at));
  try { await FileSystem.writeAsStringAsync(INBOX, JSON.stringify(keep)); } catch {}
}

export default function AppScreen() {
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [startUrl, setStartUrl] = useState<string | null>(null);

  const goTo = useCallback((url: string) => {
    webRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`);
  }, []);

  /** Hand any words saved from other apps to the site (it puts them in the red deck). */
  const flushInbox = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    const items = await readInbox();
    if (!items.length) return;
    webRef.current?.injectJavaScript(`window.__lsInbox && window.__lsInbox(${JSON.stringify(items)}); true;`);
  }, []);

  // Coming back to the app after saving words elsewhere.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') flushInbox(); });
    return () => sub.remove();
  }, [flushInbox]);

  useEffect(() => {
    Linking.getInitialURL().then((url) => setStartUrl(siteUrlFromLink(url) ?? APP_URL)).catch(() => setStartUrl(APP_URL));
    const sub = Linking.addEventListener('url', ({ url }) => {
      // While the app is open, signInWithGoogle handles the sign-in redirect.
      if (authCallbackParams(url) !== null) return;
      const site = siteUrlFromLink(url);
      if (site) goTo(site);
    });
    return () => sub.remove();
  }, [goTo]);

  // Ask for notification permission on first open, like most apps, rather
  // than waiting until the site's session is detected. The push token itself
  // is saved once we know who is signed in (onMessage below).
  useEffect(() => {
    ensurePermissions();
  }, []);

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
    const rest = authCallbackParams(result.url) ?? '';
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
    return <View style={styles.loading}><Text style={styles.brand}>🦎 LinguaScript</Text></View>;
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <WebView
        ref={webRef}
        source={{ uri: startUrl }}
        // Select text in the app → Copy · Paste · Translate · Save to LinguaScript
        // (plugins/withWebViewMenu.js keeps Android's menu and adds this item).
        menuItems={Platform.OS === 'android' ? [{ label: 'Save to LinguaScript', key: 'ls-save' }] : undefined}
        onCustomMenuSelection={(e) => {
          const text = String(e.nativeEvent.selectedText || '').trim();
          if (e.nativeEvent.key !== 'ls-save' || !text) return;
          webRef.current?.injectJavaScript(`window.__lsSaveText && window.__lsSaveText(${JSON.stringify(text)}); true;`);
        }}
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
            if (msg.type === 'inbox-ready') { flushInbox(); return; }
            if (msg.type === 'inbox-saved' && Array.isArray(msg.ats)) { removeFromInbox(msg.ats); return; }
            // The 🦎 bubble (plugins/withWordBubble.js): its copy of the deck, and on/off.
            if (msg.type === 'deck' && msg.words) {
              FileSystem.writeAsStringAsync(DECK, JSON.stringify({ language: msg.language, native: msg.native, words: msg.words, common: msg.common || [], meanings: msg.meanings || {} })).catch(() => {});
              return;
            }
            if (msg.type === 'bubble' && Platform.OS === 'android') {
              const style = msg.style === 'ring' || msg.style === 'common' ? msg.style : 'text';
              Linking.openURL(`linguascriptbubble://${msg.on ? 'start' : 'stop'}?style=${style}`).catch(() => {});
              return;
            }
            // Gold word on the lock screen, and "add the widget" (plugins/word-bubble/GoldWords.kt, DeckWidget.kt).
            if (msg.type === 'gold' && Platform.OS === 'android') {
              Linking.openURL(`linguascriptbubble://gold?on=${msg.on ? 1 : 0}`).catch(() => {});
              return;
            }
            if (msg.type === 'widget' && Platform.OS === 'android') {
              Linking.openURL(`linguascriptbubble://widget${msg.kind === 'gold' ? '?kind=gold' : ''}`).catch(() => {});
              return;
            }
            if (msg.type === 'langs') {
              FileSystem.writeAsStringAsync(CONFIG, JSON.stringify({ learning: msg.learning || '', native: msg.native || '' })).catch(() => {});
              return;
            }
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
          <View style={styles.loading}><Text style={styles.brand}>🦎 LinguaScript</Text></View>
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
  brand: { color: '#34C759', fontSize: 26, fontWeight: '600' },
});
