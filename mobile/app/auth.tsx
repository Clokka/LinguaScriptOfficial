import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { signInWithGoogle } from '@/native/google-signin';
import { tapMedium, success as hapticSuccess, error as hapticError } from '@/native/haptics';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  async function sendMagicLink() {
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
  }

  async function google() {
    setGoogleBusy(true);
    tapMedium();
    const result = await signInWithGoogle();
    setGoogleBusy(false);
    if (!result.ok && result.error !== 'cancelled') {
      hapticError();
      Alert.alert('Google sign-in', result.error);
    } else if (result.ok) {
      hapticSuccess();
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-ink">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1 px-6 justify-center"
      >
        <View className="items-center mb-10">
          <Image
            source={require('../assets/images/chameleon-glow.png')}
            style={{ width: 180, height: 180 }}
            resizeMode="contain"
          />
          <Text className="text-white text-3xl font-bold mt-4">LinguaScript</Text>
          <Text className="text-slate-400 mt-2 text-center">
            Turn the language green.
          </Text>
        </View>

        {sent ? (
          <View className="bg-ink-card border border-ink-border rounded-2xl p-6">
            <Text className="text-white text-lg font-semibold">Check your email</Text>
            <Text className="text-slate-400 mt-2">
              We sent a magic link to {email}. Tap it on this device to sign in.
            </Text>
            <Pressable onPress={() => setSent(false)} className="mt-4">
              <Text className="text-chameleon">Use a different email</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <Pressable
              onPress={google}
              disabled={googleBusy}
              className="bg-white rounded-2xl py-4 flex-row items-center justify-center"
            >
              {googleBusy ? (
                <ActivityIndicator />
              ) : (
                <>
                  <Text className="text-lg mr-2">G</Text>
                  <Text className="text-ink font-semibold">Continue with Google</Text>
                </>
              )}
            </Pressable>

            <View className="flex-row items-center my-6">
              <View className="flex-1 h-px bg-ink-border" />
              <Text className="text-slate-500 mx-3">or</Text>
              <View className="flex-1 h-px bg-ink-border" />
            </View>

            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              className="bg-ink-card border border-ink-border rounded-2xl px-4 py-4 text-white"
            />
            <Pressable
              onPress={sendMagicLink}
              disabled={sending || !email.trim()}
              className="bg-chameleon rounded-2xl py-4 mt-3 items-center"
              style={{ opacity: sending || !email.trim() ? 0.5 : 1 }}
            >
              {sending ? (
                <ActivityIndicator color="#0b1215" />
              ) : (
                <Text className="text-ink font-semibold">Send magic link</Text>
              )}
            </Pressable>
          </View>
        )}

        <Text className="text-slate-500 text-xs text-center mt-8">
          By continuing you agree to our privacy policy.
        </Text>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
