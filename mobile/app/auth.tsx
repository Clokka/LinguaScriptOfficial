import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
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

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Type your email address above, then tap this link.');
      return;
    }
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOtp({ email: email.trim() }),
        15000,
      );
      if (error) throw error;
      Alert.alert('Check your email', 'We sent you a magic sign-in link. Tap it to log in instantly.');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not send sign-in link.');
    }
  };

  const busy = loading || googleLoading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          {/* Logo */}
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
            <Text style={styles.logoText}>LinguaScript</Text>
            <Text style={styles.tagline}>Sign in to continue learning</Text>
          </View>

          {/* Google sign-in */}
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

          {/* Email + password form */}
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
                  {mode === 'sign_in' ? 'Sign in  ›' : 'Create account  ›'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Forgot password */}
          {mode === 'sign_in' && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.linkRow}>
              <Text style={styles.linkText}>Forgot password? Sign in with email code</Text>
            </TouchableOpacity>
          )}

          {/* Toggle sign in / sign up */}
          <TouchableOpacity
            onPress={() => setMode(mode === 'sign_in' ? 'sign_up' : 'sign_in')}
            style={styles.linkRow}
          >
            <Text style={styles.mutedText}>
              {mode === 'sign_in' ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.linkText}>{mode === 'sign_in' ? 'Sign up' : 'Sign in'}</Text>
            </Text>
          </TouchableOpacity>

          {/* Privacy */}
          <Text style={styles.privacy}>By continuing you agree to our privacy policy.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  flex: { flex: 1 },
  inner: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32, justifyContent: 'center' },

  logoWrap: { alignItems: 'center', marginBottom: 40 },
  logoImage: { width: 96, height: 96, marginBottom: 14 },
  logoText: { fontSize: 30, fontWeight: '800', color: '#f0fdf4', letterSpacing: -0.5 },
  tagline: { fontSize: 15, color: '#9ca3af', marginTop: 6, textAlign: 'center' },

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

  form: { gap: 12, marginBottom: 16 },
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

  linkRow: { alignItems: 'center', paddingVertical: 8 },
  linkText: { color: '#22c55e', fontSize: 14, fontWeight: '600' },
  mutedText: { color: '#9ca3af', fontSize: 14, textAlign: 'center' },
  privacy: { color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 16 },
});
