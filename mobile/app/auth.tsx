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

WebBrowser.maybeCompleteAuthSession();

const REDIRECT_URL = Linking.createURL('auth-callback');

// After a successful auth event, check if the user completed onboarding and
// route them to the correct screen. New users go to /onboarding; returning
// users go straight to /(tabs).
async function routeAfterAuth(userId: string, router: ReturnType<typeof useRouter>) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('onboarded')
      .eq('user_id', userId)
      .maybeSingle();
    router.replace(data?.onboarded ? '/(tabs)' : '/onboarding');
  } catch {
    router.replace('/onboarding');
  }
}

// Race an async operation against a timeout. Rejects with a timeout error
// after `ms` milliseconds so loading states can never stay stuck forever.
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out. Check your connection and try again.')), ms),
    ),
  ]);
}

export default function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // ── Google OAuth ─────────────────────────────────────────────────────────
  // Opens an in-app browser sheet (Chrome Custom Tab / SFSafariViewController).
  // The user never leaves the app; the sheet closes when Google redirects back
  // to the linguascript:// deep link scheme.
  const signInWithGoogle = async () => {
    setGoogleLoading(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: REDIRECT_URL,
            skipBrowserRedirect: true,
          },
        }),
        10000,
      );

      if (error || !data.url) {
        Alert.alert('Google sign-in failed', error?.message ?? 'Could not start sign-in.');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL, {
        showInRecents: false,
      });

      if (result.type !== 'success' || !result.url) return;

      const { error: sessionError, data: sessionData } = await withTimeout(
        supabase.auth.exchangeCodeForSession(result.url),
        15000,
      );
      if (sessionError) {
        Alert.alert('Sign-in error', sessionError.message);
        return;
      }

      if (sessionData.user) {
        await routeAfterAuth(sessionData.user.id, router);
      }
    } catch (err: any) {
      Alert.alert('Sign-in failed', err.message ?? 'Something went wrong. Please try again.');
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
        const { error, data } = await withTimeout(
          supabase.auth.signInWithPassword({ email: email.trim(), password }),
          15000,
        );
        if (error) throw error;
        if (data.user) await routeAfterAuth(data.user.id, router);
      } else {
        const { error } = await withTimeout(
          supabase.auth.signUp({ email: email.trim(), password }),
          15000,
        );
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

        {/* Sign in / Sign up toggle */}
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
  gMarkText: { color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 },
  googleBtnText: { color: '#1f2937', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },

  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
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
