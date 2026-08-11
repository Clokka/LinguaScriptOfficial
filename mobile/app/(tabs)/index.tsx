import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
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

// Inject Supabase session into the website's localStorage so the user is
// automatically signed in on the web side without a second login prompt.
function buildSessionScript(accessToken: string, refreshToken: string, userId: string): string {
  const sessionKey = `sb-ffephracinqeylfhqkiz-auth-token`;
  const session = JSON.stringify({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: 'bearer',
    user: { id: userId },
  });
  return `
    (function() {
      try {
        localStorage.setItem('${sessionKey}', JSON.stringify(${JSON.stringify(session)}));
      } catch(e) {}
    })();
    true;
  `;
}

export default function WebAppScreen() {
  const { user } = useAuth();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionScript, setSessionScript] = useState<string>('true;');

  useEffect(() => {
    registerForPushNotifications();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase.auth.getSession().then(({ data }) => {
      const s = data?.session;
      if (s?.access_token && s?.refresh_token) {
        setSessionScript(buildSessionScript(s.access_token, s.refresh_token, user.id));
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
        injectedJavaScript={sessionScript}
        onNavigationStateChange={onNavChange}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#22c55e" />
          </View>
        )}
        startInLoadingState
        onShouldStartLoadWithRequest={(req) => {
          // Keep navigation inside linguascript.co.uk; open external links in system browser
          return req.url.startsWith(BASE_URL) || req.url.startsWith('about:');
        }}
      />

      {/* Slim bottom bar — only shows when there's history to go back in */}
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
