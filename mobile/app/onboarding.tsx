import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LANGUAGES, fetchProfile, updateActiveLanguage } from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { tapLight, success as hapticSuccess } from '@/native/haptics';

export default function OnboardingScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  const [checking, setChecking] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchProfile(supabase, user.id).then((p) => {
      if (p?.learning_language) {
        // Returning user already has a language — skip straight to app.
        router.replace('/(tabs)');
      } else {
        setChecking(false);
      }
    });
  }, [user]);

  const finish = async () => {
    if (!selected || !user) return;
    setSaving(true);
    tapLight();
    await updateActiveLanguage(supabase, user.id, selected);
    hapticSuccess();
    setSaving(false);
    router.replace('/(tabs)');
  };

  if (checking) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <Text style={s.emoji}>🌍</Text>
        <Text style={s.title}>What are you learning?</Text>
        <Text style={s.sub}>
          Pick the language you want to master. You can change this any time in your profile.
        </Text>

        <View style={s.grid}>
          {LANGUAGES.filter((l) => l.code !== 'en').map((l) => {
            const active = selected === l.code;
            return (
              <Pressable
                key={l.code}
                onPress={() => { tapLight(); setSelected(l.code); }}
                style={[s.langCard, active && s.langCardActive]}
              >
                <Text style={s.langFlag}>{l.flag}</Text>
                <Text style={[s.langLabel, active && s.langLabelActive]}>
                  {l.label}
                </Text>
                {active && <View style={s.checkDot} />}
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={finish}
          disabled={!selected || saving}
          style={[s.continueBtn, (!selected || saving) && { opacity: 0.4 }]}
        >
          {saving
            ? <ActivityIndicator color="#0b1215" />
            : <Text style={s.continueBtnText}>Start learning →</Text>
          }
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0b1215' },
  center: { flex: 1, backgroundColor: '#0b1215', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 24, paddingTop: 48, paddingBottom: 48, alignItems: 'center' },

  emoji: { fontSize: 72, marginBottom: 20 },
  title: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  sub:   { color: '#64748b', fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 36 },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center',
    gap: 12, marginBottom: 40,
  },
  langCard: {
    width: 140, alignItems: 'center', paddingVertical: 20, paddingHorizontal: 12,
    backgroundColor: '#111c22', borderRadius: 20,
    borderWidth: 2, borderColor: '#243239',
  },
  langCardActive: { borderColor: '#22c55e', backgroundColor: '#14532d22' },
  langFlag:       { fontSize: 40, marginBottom: 8 },
  langLabel:      { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  langLabelActive: { color: '#22c55e' },
  checkDot: {
    position: 'absolute', top: 10, right: 10,
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e',
  },

  continueBtn: {
    backgroundColor: '#22c55e', borderRadius: 18,
    paddingVertical: 18, paddingHorizontal: 60, alignItems: 'center',
  },
  continueBtnText: { color: '#0b1215', fontSize: 17, fontWeight: '800' },
});
