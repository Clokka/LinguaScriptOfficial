import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const LANGUAGES = [
  { code: 'fr', label: 'French', flag: '🇫🇷' },
  { code: 'es', label: 'Spanish', flag: '🇪🇸' },
  { code: 'de', label: 'German', flag: '🇩🇪' },
  { code: 'it', label: 'Italian', flag: '🇮🇹' },
  { code: 'pt', label: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { code: 'ru', label: 'Russian', flag: '🇷🇺' },
  { code: 'nl', label: 'Dutch', flag: '🇳🇱' },
  { code: 'tr', label: 'Turkish', flag: '🇹🇷' },
  { code: 'pl', label: 'Polish', flag: '🇵🇱' },
  { code: 'sv', label: 'Swedish', flag: '🇸🇪' },
  { code: 'hi', label: 'Hindi', flag: '🇮🇳' },
];

const LEVELS = [
  { code: 'A2', label: 'Beginner', desc: 'I know a few basics' },
  { code: 'B1', label: 'Elementary', desc: 'I can handle simple conversations' },
  { code: 'B2', label: 'Intermediate', desc: 'I can discuss everyday topics' },
  { code: 'C1', label: 'Advanced', desc: 'I understand most native content' },
];

const INTERESTS = [
  { id: 'gaming', label: 'Gaming', emoji: '🎮' },
  { id: 'football', label: 'Football', emoji: '⚽' },
  { id: 'fitness', label: 'Fitness', emoji: '🏃' },
  { id: 'travel', label: 'Travel', emoji: '✈️' },
  { id: 'cooking', label: 'Cooking', emoji: '🍳' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'films', label: 'Films & TV', emoji: '🎬' },
  { id: 'comedy', label: 'Comedy', emoji: '🎭' },
  { id: 'history', label: 'History', emoji: '📚' },
  { id: 'business', label: 'Business', emoji: '💼' },
  { id: 'news', label: 'News', emoji: '📰' },
  { id: 'cars', label: 'Cars', emoji: '🚗' },
  { id: 'art', label: 'Art & Design', emoji: '🎨' },
  { id: 'tech', label: 'Technology', emoji: '📱' },
  { id: 'anime', label: 'Anime', emoji: '🇯🇵' },
  { id: 'culture', label: 'Culture', emoji: '🌍' },
];

const GOALS = [
  { value: 1, label: '1 video / day', desc: 'Casual — 10–15 min' },
  { value: 2, label: '2 videos / day', desc: 'Regular — 20–30 min' },
  { value: 3, label: '3 videos / day', desc: 'Serious — 30–45 min' },
  { value: 5, label: '5+ videos / day', desc: 'Intensive — 1+ hour' },
];

const TOTAL_STEPS = 4;

export default function OnboardingScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [targetLang, setTargetLang] = useState('');
  const [level, setLevel] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [dailyGoal, setDailyGoal] = useState(1);
  const [saving, setSaving] = useState(false);

  const toggleInterest = (id: string) => {
    setInterests(curr => {
      if (curr.includes(id)) return curr.filter(x => x !== id);
      if (curr.length >= 5) return curr;
      return [...curr, id];
    });
  };

  const canNext = () => {
    if (step === 0) return !!targetLang;
    if (step === 1) return !!level;
    if (step === 2) return interests.length >= 1;
    return true;
  };

  const finish = async () => {
    if (!user) { router.replace('/auth'); return; }
    setSaving(true);
    try {
      const profileData = {
        learning_language: targetLang,
        native_language: 'en',
        cef_level: level,
        interests,
        daily_video_goal: dailyGoal,
        onboarded: true,
      };

      const { data: existing } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        await supabase.from('profiles').update(profileData as any).eq('user_id', user.id);
      } else {
        await supabase.from('profiles').insert({ user_id: user.id, ...(profileData as any) });
      }

      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Could not save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const stepTitles = [
    { emoji: '🌍', title: 'What language are you learning?', subtitle: "We'll find videos you'll actually want to watch." },
    { emoji: '📊', title: "What's your current level?", subtitle: "We'll recommend content at the right difficulty." },
    { emoji: '❤️', title: 'What do you enjoy?', subtitle: 'Pick up to 5 topics. Your feed will be built around these.' },
    { emoji: '🎯', title: 'Set your daily goal', subtitle: 'How many videos do you want to watch each day?' },
  ];

  const current = stepTitles[step];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Progress bar */}
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View key={i} style={[styles.progressSeg, i <= step && styles.progressSegActive]} />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.stepEmoji}>{current.emoji}</Text>
        <Text style={styles.title}>{current.title}</Text>
        <Text style={styles.subtitle}>{current.subtitle}</Text>

        {/* Step 0: Language picker */}
        {step === 0 && (
          <View style={styles.grid}>
            {LANGUAGES.map(lang => (
              <TouchableOpacity
                key={lang.code}
                style={[styles.chip, targetLang === lang.code && styles.chipActive]}
                onPress={() => setTargetLang(lang.code)}
              >
                <Text style={styles.chipEmoji}>{lang.flag}</Text>
                <Text style={[styles.chipLabel, targetLang === lang.code && styles.chipLabelActive]}>
                  {lang.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 1: Level picker */}
        {step === 1 && (
          <View style={styles.cardList}>
            {LEVELS.map(l => (
              <TouchableOpacity
                key={l.code}
                style={[styles.card, level === l.code && styles.cardActive]}
                onPress={() => setLevel(l.code)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, level === l.code && styles.cardTitleActive]}>
                    {l.label}
                  </Text>
                  <Text style={styles.cardDesc}>{l.desc}</Text>
                </View>
                <View style={[styles.badge, level === l.code && styles.badgeActive]}>
                  <Text style={[styles.badgeText, level === l.code && styles.badgeTextActive]}>
                    {l.code}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Step 2: Interests */}
        {step === 2 && (
          <>
            <Text style={styles.selectionHint}>
              {interests.length}/5 selected
            </Text>
            <View style={styles.grid}>
              {INTERESTS.map(i => (
                <TouchableOpacity
                  key={i.id}
                  style={[
                    styles.chip,
                    interests.includes(i.id) && styles.chipActive,
                    interests.length >= 5 && !interests.includes(i.id) && styles.chipDisabled,
                  ]}
                  onPress={() => toggleInterest(i.id)}
                  disabled={interests.length >= 5 && !interests.includes(i.id)}
                >
                  <Text style={styles.chipEmoji}>{i.emoji}</Text>
                  <Text style={[styles.chipLabel, interests.includes(i.id) && styles.chipLabelActive]}>
                    {i.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Step 3: Daily goal */}
        {step === 3 && (
          <View style={styles.cardList}>
            {GOALS.map(g => (
              <TouchableOpacity
                key={g.value}
                style={[styles.card, dailyGoal === g.value && styles.cardActive]}
                onPress={() => setDailyGoal(g.value)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, dailyGoal === g.value && styles.cardTitleActive]}>
                    {g.label}
                  </Text>
                  <Text style={styles.cardDesc}>{g.desc}</Text>
                </View>
                {dailyGoal === g.value && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer buttons */}
      <View style={styles.footer}>
        {step < TOTAL_STEPS - 1 ? (
          <TouchableOpacity
            style={[styles.primaryBtn, !canNext() && styles.btnDisabled]}
            onPress={() => setStep(s => s + 1)}
            disabled={!canNext()}
          >
            <Text style={styles.primaryBtnText}>Continue</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={finish}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Start learning 🦎</Text>
            )}
          </TouchableOpacity>
        )}
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep(s => s - 1)} disabled={saving}>
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#1f2937' },
  progressSegActive: { backgroundColor: '#22c55e' },

  content: { paddingHorizontal: 24, paddingTop: 20 },
  stepEmoji: { fontSize: 44, textAlign: 'center', marginBottom: 14 },
  title: { fontSize: 22, fontWeight: '800', color: '#f0fdf4', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20, marginBottom: 28 },

  selectionHint: { fontSize: 13, color: '#6b7280', textAlign: 'right', marginBottom: 12 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
  },
  chipActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  chipDisabled: { opacity: 0.4 },
  chipEmoji: { fontSize: 15 },
  chipLabel: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  chipLabelActive: { color: '#22c55e' },

  cardList: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    backgroundColor: '#111827',
  },
  cardActive: { borderColor: '#22c55e', backgroundColor: '#052e16' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#e5e7eb', marginBottom: 2 },
  cardTitleActive: { color: '#22c55e' },
  cardDesc: { fontSize: 12, color: '#6b7280' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#1f2937' },
  badgeActive: { backgroundColor: '#166534' },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#6b7280' },
  badgeTextActive: { color: '#22c55e' },
  checkmark: { fontSize: 18, color: '#22c55e', fontWeight: '700' },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
    gap: 10,
    backgroundColor: '#0a0a0f',
    borderTopWidth: 1,
    borderTopColor: '#111827',
  },
  primaryBtn: { backgroundColor: '#22c55e', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  btnDisabled: { opacity: 0.4 },
  backBtn: { alignItems: 'center', paddingVertical: 8 },
  backBtnText: { color: '#6b7280', fontSize: 14 },
});
