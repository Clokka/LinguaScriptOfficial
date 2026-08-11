import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewNavigation } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { registerForPushNotifications } from '../../lib/notifications';

const BASE_URL = 'https://linguascript.co.uk';
const HOME_URL = `${BASE_URL}/discover`;
const SESSION_KEY = 'sb-ffephracinqeylfhqkiz-auth-token';

// Runs BEFORE the page scripts load so the website's Supabase client
// finds the session in localStorage during its own initialization.
// We pass the full session object (not a stripped version) so expires_at
// and the complete user record are present and Supabase accepts it.
function buildPreloadScript(fullSession: object): string {
  // JSON.stringify(sessionJson) produces a safe quoted string literal
  // that can be embedded directly inside the JS without encoding issues.
  const sessionJson = JSON.stringify(fullSession);
  return `
    (function() {
      try {
        localStorage.setItem(${JSON.stringify(SESSION_KEY)}, ${JSON.stringify(sessionJson)});
      } catch(e) {}
    })();
    true;
  `;
}

export default function WebAppScreen() {
  const { user } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [preloadScript, setPreloadScript] = useState<string>('true;');

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  // Fetch the full native session and build the preload script once we have a user.
  useEffect(() => {
    if (!user) return;
    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      if (session) {
        setPreloadScript(buildPreloadScript(session));
      }
    });
  }, [user]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavChange = (nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <WebView
        ref={webViewRef}
        source={{ uri: HOME_URL }}
        style={styles.webview}
        // BEFORE content loads — so Supabase client finds session on init
        injectedJavaScriptBeforeContentLoaded={preloadScript}
        onNavigationStateChange={onNavChange}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        )}
        // Allow all navigation within the WebView (same as APK's linkOpenMode: internal).
        // The website handles YouTube embeds, Google auth redirects, etc. internally.
        onShouldStartLoadWithRequest={() => true}
      />

      {/* Slim nav bar — back, refresh, home — appears only when user has navigated away */}
      {canGoBack && (
        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => webViewRef.current?.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => webViewRef.current?.reload()}>
            <Ionicons name="refresh" size={20} color="#9ca3af" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => webViewRef.current?.injectJavaScript(`window.location.href='${HOME_URL}';true;`)}
          >
            <Ionicons name="home" size={20} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  webview: { flex: 1 },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0f',
  },
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#0f1117',
    borderTopWidth: 1,
    borderTopColor: '#1f2937',
    paddingBottom: 4,
  },
  navBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
});
