import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import {
  tapLight,
  tapMedium,
  success as hapticSuccess,
  error as hapticError,
} from '@/native/haptics';

type Screen = 'welcome' | 'email' | 'verify';

export default function AuthScreen() {
  const [screen, setScreen]       = useState<Screen>('welcome');
  const [isSignUp, setIsSignUp]   = useState(false);
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading]     = useState(false);
  const [otp, setOtp]             = useState('');
  const [verifying, setVerifying] = useState(false);

  // ── Skip / anonymous ───────────────────────────────────────────────────
  const handleSkip = async () => {
    tapLight();
    setLoading(true);
    const { error } = await supabase.auth.signInAnonymously();
    setLoading(false);
    if (error) {
      Alert.alert(
        'Could not skip',
        'Enable "Allow anonymous sign-ins" in your Supabase dashboard → Authentication → Sign In → Anonymous.',
      );
    }
  };

  // ── Google Sign-In via Chrome Custom Tab ───────────────────────────────
  const handleGoogleSignIn = async () => {
    tapLight();
    setLoading(true);
    try {
      const redirectTo = Linking.createURL('auth-callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        Alert.alert('Google Sign-In failed', error?.message ?? 'Could not get sign-in URL');
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

      if (result.type === 'success') {
        const url = result.url;

        // PKCE flow: code in query params
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code as string | undefined;
        if (code) {
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchErr) Alert.alert('Sign-in failed', exchErr.message);
          else hapticSuccess();
          return;
        }

        // Implicit flow: tokens in URL fragment
        const fragment = url.split('#')[1] ?? '';
        const params = new URLSearchParams(fragment);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: sessErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessErr) Alert.alert('Sign-in failed', sessErr.message);
          else hapticSuccess();
        } else {
          Alert.alert('Sign-in failed', 'No session returned. Please try again.');
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  // ── Email submit ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const emailTrim = email.trim().toLowerCase();
    const pass      = password.trim();
    if (!emailTrim || !pass) return;
    setLoading(true);
    tapMedium();
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email: emailTrim,
        password: pass,
        options: {
          data: { display_name: displayName.trim() || undefined },
          emailRedirectTo: 'linguascript://auth-callback',
        },
      });
      setLoading(false);
      if (error) { hapticError(); Alert.alert('Sign-up failed', error.message); }
      else {
        hapticSuccess();
        Alert.alert('Account created!', 'Check your email to confirm, then sign in.', [
          { text: 'OK', onPress: () => { setIsSignUp(false); setPassword(''); } },
        ]);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailTrim, password: pass });
      setLoading(false);
      if (error) { hapticError(); Alert.alert('Sign-in failed', error.message); }
      else hapticSuccess();
    }
  };

  // ── Magic link ─────────────────────────────────────────────────────────
  const sendOtp = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) { Alert.alert('Enter your email first'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email: emailTrim, options: { shouldCreateUser: false } });
    setLoading(false);
    if (error) { Alert.alert('Could not send code', error.message); return; }
    hapticSuccess();
    setScreen('verify');
  };

  const verifyOtp = async () => {
    const code = otp.trim();
    if (code.length !== 6) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code, type: 'email' });
    setVerifying(false);
    if (error) { hapticError(); Alert.alert('Incorrect code', 'Check the 6-digit code and try again.'); }
    else hapticSuccess();
  };

  // ── OTP verify ─────────────────────────────────────────────────────────
  if (screen === 'verify') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
          <Pressable onPress={() => { setScreen('email'); setOtp(''); }} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <Text style={s.bigEmoji}>✉️</Text>
          <Text style={s.pageTitle}>Check your email</Text>
          <Text style={s.pageSub}>
            6-digit code sent to{'\n'}<Text style={{ color: '#22c55e' }}>{email}</Text>
          </Text>
          <TextInput
            value={otp}
            onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            maxLength={6}
            placeholder="000000"
            placeholderTextColor="#334155"
            style={s.otpInput}
            autoFocus
            returnKeyType="go"
            onSubmitEditing={verifyOtp}
          />
          <Pressable
            onPress={verifyOtp}
            disabled={otp.length !== 6 || verifying}
            style={[s.primaryBtn, (otp.length !== 6 || verifying) && { opacity: 0.45 }]}
          >
            {verifying ? <ActivityIndicator color="#0b1215" /> : <Text style={s.primaryBtnText}>Verify →</Text>}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Email form ─────────────────────────────────────────────────────────
  if (screen === 'email') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
          <Pressable onPress={() => setScreen('welcome')} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <Text style={s.bigEmoji}>🦎</Text>
          <Text style={s.pageTitle}>LinguaScript</Text>
          <Text style={s.pageSub}>{isSignUp ? 'Create your account' : 'Sign in to continue'}</Text>

          {isSignUp && (
            <TextInput
              value={displayName} onChangeText={setDisplayName}
              placeholder="Your name" placeholderTextColor="#475569"
              autoCapitalize="words" style={s.input}
            />
          )}
          <TextInput
            value={email} onChangeText={setEmail}
            placeholder="Email address" placeholderTextColor="#475569"
            autoCapitalize="none" keyboardType="email-address" autoComplete="email" style={s.input}
          />
          <TextInput
            value={password} onChangeText={setPassword}
            placeholder="Password" placeholderTextColor="#475569"
            secureTextEntry autoComplete={isSignUp ? 'new-password' : 'current-password'}
            returnKeyType="go" onSubmitEditing={handleSubmit} style={s.input}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !email.trim() || !password.trim()}
            style={[s.primaryBtn, (loading || !email.trim() || !password.trim()) && { opacity: 0.45 }]}
          >
            {loading ? <ActivityIndicator color="#0b1215" /> : <Text style={s.primaryBtnText}>{isSignUp ? 'Create account →' : 'Sign in →'}</Text>}
          </Pressable>

          {!isSignUp && (
            <Pressable onPress={sendOtp} disabled={loading} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={s.linkText}>Forgot password? Sign in with email code</Text>
            </Pressable>
          )}
          <Pressable onPress={() => { setIsSignUp((v) => !v); setPassword(''); }} style={{ marginTop: 20, alignItems: 'center' }}>
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: '#22c55e', fontWeight: '700' }}>{isSignUp ? 'Sign in' : 'Sign up'}</Text>
            </Text>
          </Pressable>
          <Text style={s.legal}>By continuing you agree to our privacy policy.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Welcome ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
        <Text style={s.bigEmoji}>🦎</Text>
        <Text style={s.pageTitle}>LinguaScript</Text>
        <Text style={s.pageSub}>Learn through videos you actually love</Text>

        <View style={{ gap: 12, marginTop: 32 }}>
          <Pressable
            onPress={handleGoogleSignIn}
            disabled={loading}
            style={[s.googleBtn, loading && { opacity: 0.6 }]}
          >
            {loading
              ? <ActivityIndicator color="#1a1a1a" size="small" />
              : <Text style={s.googleBtnText}>🔵  Continue with Google</Text>
            }
          </Pressable>

          <Pressable onPress={() => { tapLight(); setScreen('email'); }} style={s.outlineBtn}>
            <Text style={s.outlineBtnText}>Sign in with email</Text>
          </Pressable>

          <Pressable onPress={() => { tapLight(); setIsSignUp(true); setScreen('email'); }} style={s.outlineBtn}>
            <Text style={s.outlineBtnText}>Create account</Text>
          </Pressable>
        </View>

        <Pressable onPress={handleSkip} disabled={loading} style={{ marginTop: 32, alignItems: 'center' }}>
          <Text style={{ color: '#334155', fontSize: 13 }}>Skip sign-in for now →</Text>
        </Pressable>

        <Text style={s.legal}>By continuing you agree to our privacy policy.</Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#0b1215' },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32, justifyContent: 'center' },

  back:     { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { color: '#22c55e', fontSize: 15 },

  bigEmoji:  { fontSize: 72, textAlign: 'center', marginBottom: 10 },
  pageTitle: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  pageSub:   { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },

  input: {
    backgroundColor: '#111c22', borderWidth: 1.5, borderColor: '#243239',
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14,
    color: '#fff', fontSize: 15, marginBottom: 10,
  },
  otpInput: {
    backgroundColor: '#111c22', borderWidth: 2, borderColor: '#22c55e66',
    borderRadius: 20, paddingHorizontal: 24, paddingVertical: 18,
    color: '#fff', fontSize: 40, fontWeight: '800', textAlign: 'center',
    letterSpacing: 12, marginBottom: 16,
  },

  googleBtn:     { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  googleBtnText: { color: '#1a1a1a', fontWeight: '700', fontSize: 16 },

  primaryBtn:     { backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },

  outlineBtn:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#243239', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  outlineBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 16 },

  linkText: { color: '#22c55e', fontSize: 13, textAlign: 'center' },
  legal:    { color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 24 },
});
