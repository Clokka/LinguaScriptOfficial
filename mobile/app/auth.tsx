import { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Animated,
  StyleSheet,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/native/google-signin';
import {
  tapLight,
  tapMedium,
  success as hapticSuccess,
  error as hapticError,
} from '@/native/haptics';

type Screen = 'welcome' | 'email' | 'verify';

function FloatingChameleon({ size = 200 }: { size?: number }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(float, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  return (
    <Animated.Image
      source={require('../assets/images/chameleon-3d.png')}
      style={{ width: size, height: size, transform: [{ translateY }] }}
      resizeMode="contain"
    />
  );
}

export default function AuthScreen() {
  const [screen, setScreen] = useState<Screen>('welcome');
  const [isSignUp, setIsSignUp] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [googleBusy, setGoogleBusy]   = useState(false);

  const [otp, setOtp]         = useState('');
  const [verifying, setVerifying] = useState(false);

  // ── Google ─────────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    setGoogleBusy(true);
    tapMedium();
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (!result.ok && result.error !== 'cancelled') {
      hapticError();
      Alert.alert('Google sign-in failed', result.error ?? 'Unknown error');
    } else if (result.ok) {
      hapticSuccess();
    }
  };

  // ── Email ──────────────────────────────────────────────────────────────
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
      if (error) {
        hapticError();
        Alert.alert('Sign-up failed', error.message);
      } else {
        hapticSuccess();
        Alert.alert(
          'Account created!',
          'Check your email to confirm your account, then sign in.',
          [{ text: 'OK', onPress: () => { setIsSignUp(false); setPassword(''); } }],
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: emailTrim, password: pass });
      setLoading(false);
      if (error) {
        hapticError();
        Alert.alert('Sign-in failed', error.message);
      } else {
        hapticSuccess();
      }
    }
  };

  // ── Magic link / forgot password ───────────────────────────────────────
  const sendOtp = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) { Alert.alert('Enter your email first'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailTrim,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) { Alert.alert('Could not send code', error.message); return; }
    hapticSuccess();
    setScreen('verify');
  };

  const verifyOtp = async () => {
    const code = otp.trim();
    if (code.length !== 6) return;
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code,
      type: 'email',
    });
    setVerifying(false);
    if (error) {
      hapticError();
      Alert.alert('Incorrect code', 'Check the 6-digit code and try again.');
    } else {
      hapticSuccess();
    }
  };

  // ── OTP verify screen ──────────────────────────────────────────────────
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
            We sent a 6-digit code to{'\n'}
            <Text style={{ color: '#22c55e' }}>{email}</Text>
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
            {verifying
              ? <ActivityIndicator color="#0b1215" />
              : <Text style={s.primaryBtnText}>Verify code →</Text>
            }
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Email sign-in / sign-up screen ─────────────────────────────────────
  if (screen === 'email') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
          <Pressable onPress={() => setScreen('welcome')} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>

          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <FloatingChameleon size={110} />
            <Text style={s.pageTitle}>LinguaScript</Text>
            <Text style={s.pageSub}>{isSignUp ? 'Create your account' : 'Sign in to continue'}</Text>
          </View>

          {isSignUp && (
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#475569"
              autoCapitalize="words"
              style={s.input}
            />
          )}
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#475569"
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={s.input}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#475569"
            secureTextEntry
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            style={s.input}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading || !email.trim() || !password.trim()}
            style={[s.primaryBtn, (loading || !email.trim() || !password.trim()) && { opacity: 0.45 }]}
          >
            {loading
              ? <ActivityIndicator color="#0b1215" />
              : <Text style={s.primaryBtnText}>{isSignUp ? 'Create account →' : 'Sign in →'}</Text>
            }
          </Pressable>

          {!isSignUp && (
            <Pressable onPress={sendOtp} disabled={loading} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={s.linkText}>Forgot password? Sign in with email code</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => { setIsSignUp((v) => !v); setPassword(''); }}
            style={{ marginTop: 20, alignItems: 'center' }}
          >
            <Text style={{ color: '#64748b', fontSize: 14 }}>
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <Text style={{ color: '#22c55e', fontWeight: '700' }}>
                {isSignUp ? 'Sign in' : 'Sign up'}
              </Text>
            </Text>
          </Pressable>

          <Text style={s.legal}>By continuing you agree to our privacy policy.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Welcome screen (default) ───────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.welcomeContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center', paddingTop: 40 }}>
          <FloatingChameleon size={220} />
          <Text style={s.brand}>
            <Text style={{ color: '#f1f5f9' }}>Lingua</Text>
            <Text style={{ color: '#22c55e' }}>Script</Text>
          </Text>
          <Text style={s.brandSub}>Learn through videos you actually love</Text>
        </View>

        <View style={s.welcomeActions}>
          {/* Google */}
          <Pressable onPress={handleGoogle} disabled={googleBusy} style={s.googleBtn}>
            {googleBusy
              ? <ActivityIndicator color="#0b1215" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ fontSize: 20, lineHeight: 24 }}>G</Text>
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </View>
              )
            }
          </Pressable>

          {/* Email */}
          <Pressable
            onPress={() => { tapLight(); setScreen('email'); }}
            style={s.emailBtn}
          >
            <Text style={s.emailBtnText}>Continue with email</Text>
          </Pressable>

          <Text style={s.legal}>By continuing you agree to our privacy policy.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#0b1215' },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32, justifyContent: 'center' },

  welcomeContainer: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  welcomeActions:   { paddingTop: 32, gap: 12 },

  brand:    { color: '#f1f5f9', fontSize: 36, fontWeight: '800', letterSpacing: -1, marginTop: 16 },
  brandSub: { color: '#475569', fontSize: 16, marginTop: 8, textAlign: 'center' },

  googleBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleBtnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },

  emailBtn:     { backgroundColor: '#111c22', borderWidth: 1.5, borderColor: '#243239', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  emailBtnText: { color: '#94a3b8', fontWeight: '600', fontSize: 16 },

  back:     { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { color: '#22c55e', fontSize: 15 },

  bigEmoji:  { fontSize: 64, textAlign: 'center', marginBottom: 10 },
  pageTitle: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', marginTop: 8 },
  pageSub:   { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 6, marginBottom: 24, lineHeight: 20 },

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

  primaryBtn:     { backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  primaryBtnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },
  linkText:       { color: '#22c55e', fontSize: 13, textAlign: 'center' },
  legal:          { color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 16 },
});
