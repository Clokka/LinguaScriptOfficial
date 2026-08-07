import { useState, useRef } from 'react';
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
import { tapLight, tapMedium, success as hapticSuccess, error as hapticError } from '@/native/haptics';

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
    body: 'Touch a subtitle word to get the translation, pronunciation and IPA — then save it to your deck with one tap.',
  },
  {
    emoji: '📝',
    title: 'AI exercises built\nfrom your saved words',
    body: 'LinguaScript turns your saved vocabulary into personalised gap-fill exercises so nothing is forgotten.',
  },
  {
    emoji: '🔥',
    title: 'Streaks, XP, and\ncolour-coded progress',
    body: 'Words move from 🔴 to 🟠 to 🟢 as you master them. Keep your streak alive every day.',
  },
];

export default function AuthScreen() {
  const [slide, setSlide] = useState(0);
  const [showSignIn, setShowSignIn] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const goToSlide = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * W, animated: true });
    setSlide(i);
  };

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / W);
    setSlide(i);
  };

  const handleNext = () => {
    tapLight();
    if (slide < SLIDES.length - 1) {
      goToSlide(slide + 1);
    } else {
      setShowSignIn(true);
    }
  };

  const sendMagicLink = async () => {
    if (!email.trim()) return;
    setSending(true);
    tapMedium();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: 'linguascript://auth-callback' },
    });
    setSending(false);
    if (error) {
      hapticError();
      Alert.alert('Could not send link', error.message);
      return;
    }
    hapticSuccess();
    setSent(true);
  };

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

  // ── Sign-in screen ──────────────────────────────────────────────
  if (showSignIn) {
    return (
      <SafeAreaView style={s.root}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={s.signInInner}
        >
          <Pressable onPress={() => setShowSignIn(false)} style={{ alignSelf: 'flex-start', marginBottom: 24 }}>
            <Text style={{ color: '#22c55e', fontSize: 15 }}>← Back</Text>
          </Pressable>

          <Text style={s.signInEmoji}>🦎</Text>
          <Text style={s.signInTitle}>LinguaScript</Text>
          <Text style={s.signInSub}>Turn the language green.</Text>

          {sent ? (
            <View style={s.sentCard}>
              <Text style={s.sentTitle}>Check your email ✉️</Text>
              <Text style={s.sentBody}>
                We sent a magic link to {email}.{'\n'}Tap it on this device to sign in.
              </Text>
              <Pressable onPress={() => setSent(false)} style={{ marginTop: 16 }}>
                <Text style={{ color: '#22c55e', fontSize: 14 }}>Use a different email</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {/* Google */}
              <Pressable onPress={handleGoogle} disabled={googleBusy} style={s.googleBtn}>
                {googleBusy ? (
                  <ActivityIndicator color="#0b1215" />
                ) : (
                  <>
                    <Text style={{ fontSize: 18, marginRight: 10 }}>G</Text>
                    <Text style={s.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={s.dividerRow}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or</Text>
                <View style={s.dividerLine} />
              </View>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#475569"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={sendMagicLink}
                style={s.emailInput}
              />
              <Pressable
                onPress={sendMagicLink}
                disabled={sending || !email.trim()}
                style={[s.magicBtn, (sending || !email.trim()) && { opacity: 0.45 }]}
              >
                {sending ? (
                  <ActivityIndicator color="#0b1215" />
                ) : (
                  <Text style={s.magicBtnText}>Send magic link →</Text>
                )}
              </Pressable>
            </>
          )}

          <Text style={s.legal}>By continuing you agree to our privacy policy.</Text>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Onboarding slides ───────────────────────────────────────────
  return (
    <SafeAreaView style={s.root}>
      {/* Skip */}
      <Pressable onPress={() => setShowSignIn(true)} style={s.skipBtn}>
        <Text style={s.skipText}>Skip</Text>
      </Pressable>

      {/* Slides */}
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

      {/* Dots */}
      <View style={s.dotsRow}>
        {SLIDES.map((_, i) => (
          <Pressable key={i} onPress={() => goToSlide(i)} style={[s.dot, slide === i && s.dotActive]} />
        ))}
      </View>

      {/* CTA */}
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
  root: { flex: 1, backgroundColor: '#0b1215' },

  // Onboarding
  skipBtn: { position: 'absolute', top: 56, right: 20, zIndex: 10, padding: 8 },
  skipText: { color: '#64748b', fontSize: 14 },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  slideEmoji: { fontSize: 96, marginBottom: 32 },
  slideTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 38,
    marginBottom: 20,
  },
  slideBody: {
    color: '#94a3b8',
    fontSize: 17,
    textAlign: 'center',
    lineHeight: 26,
  },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#243239' },
  dotActive: { width: 24, backgroundColor: '#22c55e' },
  ctaArea: { paddingHorizontal: 24, paddingBottom: 40 },
  ctaBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaBtnText: { color: '#0b1215', fontSize: 17, fontWeight: '800' },

  // Sign-in
  signInInner: {
    flex: 1, paddingHorizontal: 28, paddingTop: 16, paddingBottom: 24,
    justifyContent: 'center',
  },
  signInEmoji: { fontSize: 72, textAlign: 'center', marginBottom: 12 },
  signInTitle: {
    color: '#fff', fontSize: 34, fontWeight: '800', textAlign: 'center',
  },
  signInSub: { color: '#64748b', fontSize: 16, textAlign: 'center', marginTop: 6, marginBottom: 40 },

  sentCard: {
    backgroundColor: '#131f26', borderWidth: 1, borderColor: '#243239',
    borderRadius: 20, padding: 24,
  },
  sentTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  sentBody: { color: '#94a3b8', marginTop: 8, lineHeight: 22 },

  googleBtn: {
    backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  googleBtnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#1e2d35' },
  dividerText: { color: '#475569', marginHorizontal: 14, fontSize: 14 },

  emailInput: {
    backgroundColor: '#131f26', borderWidth: 1.5, borderColor: '#243239',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 16,
    color: '#fff', fontSize: 16, marginBottom: 12,
  },
  magicBtn: {
    backgroundColor: '#22c55e', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  magicBtnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },

  legal: { color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 28 },
});
