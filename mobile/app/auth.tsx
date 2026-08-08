import { useRef, useState } from 'react';
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
  Dimensions,
  StyleSheet,
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

const { width: W } = Dimensions.get('window');

const SLIDES = [
  {
    emoji: '🦎',
    title: 'Learn through videos\nyou actually enjoy',
    body: 'Watch YouTube videos in your target language with live subtitles. Every word is tappable.',
  },
  {
    emoji: '💾',
    title: 'Tap any word.\nSave it instantly.',
    body: 'Touch a subtitle word to get the translation, pronunciation and IPA — then save it with one tap.',
  },
  {
    emoji: '📝',
    title: 'AI exercises built\nfrom your saved words',
    body: 'LinguaScript turns your vocabulary into personalised gap-fill exercises so nothing is forgotten.',
  },
  {
    emoji: '🔥',
    title: 'Streaks, XP, and\ncolour-coded progress',
    body: 'Words move from 🔴 to 🟠 to 🟢 as you master them. Keep your streak alive every day.',
  },
];

type Screen = 'slides' | 'signin' | 'verify';

export default function AuthScreen() {
  const [slide, setSlide]           = useState(0);
  const [screen, setScreen]         = useState<Screen>('slides');
  const [isSignUp, setIsSignUp]     = useState(false);
  const scrollRef                   = useRef<ScrollView>(null);

  // Form fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [googleBusy, setGoogleBusy]   = useState(false);

  // OTP code verify (fallback path from "forgot password")
  const [otp, setOtp]                 = useState('');
  const [verifying, setVerifying]     = useState(false);

  // ── Slide navigation ───────────────────────────────────────────────
  const goToSlide = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
    setSlide(i);
  };

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    setSlide(Math.round(e.nativeEvent.contentOffset.x / W));
  };

  const handleNext = () => {
    tapLight();
    if (slide < SLIDES.length - 1) goToSlide(slide + 1);
    else setScreen('signin');
  };

  // ── Email + password ───────────────────────────────────────────────
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
      const { error } = await supabase.auth.signInWithPassword({
        email: emailTrim,
        password: pass,
      });
      setLoading(false);
      if (error) {
        hapticError();
        Alert.alert('Sign-in failed', error.message);
      } else {
        hapticSuccess();
        // auth-context → AuthGate → /onboarding
      }
    }
  };

  // ── Forgot password / OTP sign-in ─────────────────────────────────
  const sendOtp = async () => {
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      Alert.alert('Enter your email first');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: emailTrim,
      options: { shouldCreateUser: false },
    });
    setLoading(false);
    if (error) {
      Alert.alert('Could not send code', error.message);
      return;
    }
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

  // ── Google ─────────────────────────────────────────────────────────
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

  // ── Screen: OTP verify ─────────────────────────────────────────────
  if (screen === 'verify') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
          <Pressable onPress={() => { setScreen('signin'); setOtp(''); }} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>
          <Text style={s.bigEmoji}>✉️</Text>
          <Text style={s.pageTitle}>Check your email</Text>
          <Text style={s.pageSub}>
            We sent a 6-digit sign-in code to{'\n'}
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
          <Pressable onPress={() => { setScreen('signin'); setOtp(''); }} style={{ marginTop: 24 }}>
            <Text style={s.linkText}>Use a different email</Text>
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Screen: sign in / sign up ──────────────────────────────────────
  if (screen === 'signin') {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.inner}>
          <Pressable onPress={() => setScreen('slides')} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </Pressable>

          <Text style={s.bigEmoji}>🦎</Text>
          <Text style={s.pageTitle}>LinguaScript</Text>
          <Text style={s.pageSub}>{isSignUp ? 'Create your account' : 'Sign in to continue learning'}</Text>

          {/* Google */}
          <Pressable onPress={handleGoogle} disabled={googleBusy} style={s.googleBtn}>
            {googleBusy
              ? <ActivityIndicator color="#0b1215" />
              : (
                <>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>G</Text>
                  <Text style={s.googleBtnText}>Continue with Google</Text>
                </>
              )
            }
          </Pressable>

          <View style={s.dividerRow}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or use email</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Display name (sign-up only) */}
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

  // ── Screen: onboarding slides ──────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      <Pressable onPress={() => setScreen('signin')} style={s.skipBtn}>
        <Text style={s.skipText}>Skip</Text>
      </Pressable>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {SLIDES.map((sl, i) => (
          <View key={i} style={[s.slide, { width: W }]}>
            <Text style={s.slideEmoji}>{sl.emoji}</Text>
            <Text style={s.slideTitle}>{sl.title}</Text>
            <Text style={s.slideBody}>{sl.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => goToSlide(i)} style={[s.dot, slide === i && s.dotActive]} />
        ))}
      </View>

      <View style={s.ctaArea}>
        <Pressable onPress={handleNext} style={s.ctaBtn}>
          <Text style={s.ctaBtnText}>
            {slide < SLIDES.length - 1 ? 'Next →' : 'Get started →'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:  { flex: 1, backgroundColor: '#0b1215' },
  inner: { flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24, justifyContent: 'center' },

  back:     { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { color: '#22c55e', fontSize: 15 },

  bigEmoji:  { fontSize: 64, textAlign: 'center', marginBottom: 10 },
  pageTitle: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center' },
  pageSub:   { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 4, marginBottom: 28, lineHeight: 20 },

  googleBtn: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 15, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  googleBtnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },

  dividerRow:  { flexDirection: 'row', alignItems: 'center', marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e2d35' },
  dividerText: { color: '#475569', marginHorizontal: 12, fontSize: 12 },

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

  linkText: { color: '#22c55e', fontSize: 13, textAlign: 'center' },
  legal:    { color: '#334155', fontSize: 11, textAlign: 'center', marginTop: 24 },

  skipBtn:  { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: '#64748b', fontSize: 14 },

  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingBottom: 60 },
  slideEmoji: { fontSize: 96, marginBottom: 32 },
  slideTitle: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38, marginBottom: 20 },
  slideBody:  { color: '#94a3b8', fontSize: 17, textAlign: 'center', lineHeight: 26 },
  dotsRow:    { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot:        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#243239' },
  dotActive:  { width: 24, backgroundColor: '#22c55e' },
  ctaArea:    { paddingHorizontal: 24, paddingBottom: 40 },
  ctaBtn:     { backgroundColor: '#22c55e', borderRadius: 18, paddingVertical: 18, alignItems: 'center' },
  ctaBtnText: { color: '#0b1215', fontSize: 17, fontWeight: '800' },
});
