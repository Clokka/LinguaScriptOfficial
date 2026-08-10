import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';

// Required so the in-app browser can hand tokens back on iOS.
WebBrowser.maybeCompleteAuthSession();

// The redirect URL must also be added in your Supabase Dashboard →
// Auth → URL Configuration → Redirect URLs:
//   linguascript://auth-callback
const REDIRECT_URL = Linking.createURL('auth-callback');

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Google OAuth ─────────────────────────────────────────────────────────
  // Uses expo-web-browser's openAuthSessionAsync, which shows an in-app
  // browser sheet (Chrome Custom Tab on Android, SFSafariViewController on iOS).
  // The sheet closes automatically once Google redirects back to our scheme,
  // so the user never leaves the app.
  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          // Tell Supabase not to open the browser itself; we handle it below.
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        Alert.alert('Google sign-in failed', error?.message ?? 'Could not start sign-in.');
        return;
      }

      // Open the Google consent page in an in-app browser sheet.
      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL, {
        showInRecents: false,
      });

      if (result.type !== 'success' || !result.url) {
        // User cancelled or something went wrong — nothing to do.
        return;
      }

      // Supabase uses the PKCE flow: the callback URL contains ?code=...
      // exchangeCodeForSession takes the full URL and handles the rest.
      const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
      if (sessionError) {
        Alert.alert('Sign-in error', sessionError.message);
        return;
      }

      router.replace('/(tabs)');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ── Email / password ─────────────────────────────────────────────────────
  const handleEmailAuth = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace('/(tabs)');
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) throw error;
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Tap it, then come back and sign in.',
        );
        setMode('sign_in');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? String(err));
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || googleLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logoEmoji}>🦎</Text>
          <Text style={styles.logoText}>LinguaScript</Text>
          <Text style={styles.tagline}>Learn a language through content you love.</Text>
        </View>

        {/* Google sign-in — primary CTA */}
        <TouchableOpacity
          style={[styles.googleBtn, busy && styles.btnDisabled]}
          onPress={signInWithGoogle}
          disabled={busy}
        >
          {googleLoading ? (
            <ActivityIndicator color="#1f2937" />
          ) : (
            <>
              {/* Simple "G" mark — no external image dependency */}
              <View style={styles.gMark}>
                <Text style={styles.gMarkText}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email / password tab toggle */}
        <View style={styles.toggle}>
          {(['sign_in', 'sign_up'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'sign_in' ? 'Sign in' : 'Create account'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#6b7280"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#6b7280"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'sign_up' ? 'newPassword' : 'password'}
          />
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            onPress={handleEmailAuth}
            disabled={busy}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {mode === 'sign_in' ? 'Sign in' : 'Create account'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  inner: { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },

  logoWrap: { alignItems: 'center', marginBottom: 36 },
  logoEmoji: { fontSize: 52, marginBottom: 8 },
  logoText: { fontSize: 30, fontWeight: '800', color: '#f0fdf4', letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: '#6b7280', marginTop: 6, textAlign: 'center' },

  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 15,
    marginBottom: 20,
  },
  gMark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gMarkText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 16,
  },
  googleBtnText: {
    color: '#1f2937',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: { opacity: 0.5 },

  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1f2937' },
  dividerText: { color: '#6b7280', fontSize: 13 },

  toggle: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: '#22c55e' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  toggleTextActive: { color: '#fff' },

  form: { gap: 12 },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f0fdf4',
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
