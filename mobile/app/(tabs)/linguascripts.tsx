import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { tapLight, tapMedium, success, error as hapticError } from '@/native/haptics';
import { fetchProfile } from '@linguascript/core';

interface LinguaScript {
  id: string;
  target_word: string;
  sentence: string;
  translation: string | null;
  word_state: string | null;
  completed_at: string | null;
  scheduled_for: string | null;
  mcq_options: { correct: number; options: string[] } | null;
  gap_options: { correct: string; distractors: string[] } | null;
  saved_word_id: string | null;
}

type Mode = 'list' | 'session' | 'results';
type StateGroup = 'red' | 'orange' | 'green';

const STATE_EMOJI: Record<StateGroup, string> = { red: '🔴', orange: '🟠', green: '🟢' };
const STATE_LABEL: Record<StateGroup, string> = { red: 'Master', orange: 'Learn', green: 'Review' };

export default function LinguaScriptsScreen() {
  const { user } = useAuth();
  const [language, setLanguage] = useState('es');
  const [all, setAll] = useState<LinguaScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('list');

  // Session state
  const [queue, setQueue] = useState<LinguaScript[]>([]);
  const [qIdx, setQIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [correct, setCorrect] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  // Load user language
  useEffect(() => {
    if (!user) return;
    fetchProfile(supabase, user.id).then((p) => {
      if (p?.learning_language) setLanguage(p.learning_language);
    });
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('linguascripts')
      .select(
        'id, target_word, sentence, translation, word_state, completed_at, scheduled_for, mcq_options, gap_options, saved_word_id',
      )
      .eq('user_id', user.id)
      .eq('language', language)
      .order('word_state', { ascending: false })
      .order('scheduled_for', { ascending: true });
    setAll((data as LinguaScript[]) ?? []);
    setLoading(false);
  }, [user, language]);

  useEffect(() => { load(); }, [load]);

  const now = new Date().toISOString();
  const due = all.filter((e) => !e.completed_at && (e.scheduled_for ?? '') <= now);
  const completed = all.filter((e) => !!e.completed_at);

  const grouped: Record<StateGroup, LinguaScript[]> = { red: [], orange: [], green: [] };
  for (const e of all) {
    const g = (e.word_state === 'orange' ? 'orange' : e.word_state === 'green' ? 'green' : 'red') as StateGroup;
    grouped[g].push(e);
  }

  // Start session with due exercises
  const startSession = () => {
    if (due.length === 0) return;
    tapMedium();
    setQueue(due.slice(0, 10));
    setQIdx(0);
    setSelected(null);
    setSubmitted(false);
    setTextAnswer('');
    setCorrect(0);
    setXpEarned(0);
    setMode('session');
  };

  const currentExercise = queue[qIdx];

  // Check if answer is correct
  const checkAnswer = (): boolean => {
    if (!currentExercise) return false;
    const mcq = currentExercise.mcq_options;
    if (mcq) {
      return selected === mcq.correct;
    }
    const gap = currentExercise.gap_options;
    if (gap) {
      return textAnswer.trim().toLowerCase() === gap.correct.toLowerCase();
    }
    return false;
  };

  const handleSubmit = async () => {
    if (!user || !currentExercise) return;
    tapLight();
    const isCorrect = checkAnswer();
    setSubmitted(true);

    if (isCorrect) {
      success();
      setCorrect((c) => c + 1);
      const xp = 15;
      setXpEarned((x) => x + xp);
    } else {
      hapticError();
    }

    // Write review log
    await supabase.from('linguascript_reviews').insert({
      user_id: user.id,
      word_id: currentExercise.saved_word_id ?? currentExercise.id,
      correct: isCorrect,
      mode: currentExercise.mcq_options ? 'mcq' : 'gap-fill',
      timestamp: new Date().toISOString(),
    });

    // Mark exercise complete + update saved_word
    await Promise.all([
      supabase
        .from('linguascripts')
        .update({ completed_at: new Date().toISOString(), correct: isCorrect, attempts: 1 })
        .eq('id', currentExercise.id),
      currentExercise.saved_word_id
        ? supabase
            .from('saved_words')
            .update({ last_reviewed_at: new Date().toISOString() })
            .eq('id', currentExercise.saved_word_id)
        : Promise.resolve(),
    ]);
  };

  const handleNext = () => {
    tapLight();
    if (qIdx + 1 >= queue.length) {
      setMode('results');
    } else {
      setQIdx((i) => i + 1);
      setSelected(null);
      setSubmitted(false);
      setTextAnswer('');
    }
  };

  const finishSession = () => {
    tapMedium();
    load();
    setMode('list');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  /* ── Results ── */
  if (mode === 'results') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.center}>
          <Text style={{ fontSize: 64 }}>🦎</Text>
          <Text style={styles.h1}>Session complete!</Text>
          <Text style={styles.muted}>{correct}/{queue.length} correct</Text>
          <Text style={{ color: '#22c55e', fontSize: 22, fontWeight: '700', marginTop: 8 }}>
            +{xpEarned} XP
          </Text>
          <Pressable onPress={finishSession} style={[styles.btn, { marginTop: 32 }]}>
            <Text style={styles.btnText}>Back to exercises</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Session / Exercise ── */
  if (mode === 'session' && currentExercise) {
    const mcq = currentExercise.mcq_options;
    const gap = currentExercise.gap_options;
    const isCorrect = submitted ? checkAnswer() : false;

    // Build display sentence with blank highlighted
    const sentenceParts = currentExercise.sentence.split('_____');

    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Pressable onPress={() => { tapLight(); setMode('list'); }}>
              <Text style={{ color: '#22c55e' }}>✕ Exit</Text>
            </Pressable>
            <Text style={styles.muted}>{qIdx + 1} / {queue.length}</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${((qIdx + 1) / queue.length) * 100}%` }]} />
          </View>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Word */}
          <View style={{ marginTop: 20, marginBottom: 24 }}>
            <Text style={styles.wordLabel}>{currentExercise.target_word}</Text>
            {currentExercise.translation && (
              <Text style={styles.muted}>{currentExercise.translation}</Text>
            )}
          </View>

          {/* Sentence with blank */}
          <View style={styles.sentenceBox}>
            <Text style={styles.sentenceText}>
              {sentenceParts[0]}
              <Text style={styles.blank}>
                {submitted
                  ? (mcq ? mcq.options[mcq.correct] : gap?.correct ?? '_____')
                  : '_____'}
              </Text>
              {sentenceParts[1] ?? ''}
            </Text>
          </View>

          {/* MCQ options */}
          {mcq && (
            <View style={{ marginTop: 24, gap: 12 }}>
              {mcq.options.map((opt, i) => {
                let bg = '#131f26';
                let border = '#243239';
                let textColor = '#fff';
                if (submitted) {
                  if (i === mcq.correct) { bg = '#14532d'; border = '#22c55e'; textColor = '#22c55e'; }
                  else if (i === selected && i !== mcq.correct) { bg = '#450a0a'; border = '#ef4444'; textColor = '#ef4444'; }
                } else if (i === selected) {
                  bg = '#1e3a4a'; border = '#22c55e';
                }
                return (
                  <Pressable
                    key={i}
                    disabled={submitted}
                    onPress={() => { tapLight(); setSelected(i); }}
                    style={[styles.option, { backgroundColor: bg, borderColor: border }]}
                  >
                    <Text style={{ color: textColor, fontSize: 16 }}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Gap-fill text input */}
          {!mcq && gap && !submitted && (
            <TextInput
              style={styles.gapInput}
              value={textAnswer}
              onChangeText={setTextAnswer}
              placeholder={`Type "${currentExercise.target_word}"…`}
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}

          {/* Feedback */}
          {submitted && (
            <View style={[styles.feedbackBox, { backgroundColor: isCorrect ? '#14532d' : '#450a0a' }]}>
              <Text style={{ color: isCorrect ? '#22c55e' : '#ef4444', fontSize: 17, fontWeight: '700' }}>
                {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
              </Text>
              {!isCorrect && (
                <Text style={{ color: '#94a3b8', marginTop: 4 }}>
                  Answer: {mcq ? mcq.options[mcq.correct] : gap?.correct}
                </Text>
              )}
            </View>
          )}

          {/* Submit / Next */}
          <View style={{ marginTop: 24 }}>
            {!submitted ? (
              <Pressable
                onPress={handleSubmit}
                disabled={mcq ? selected === null : textAnswer.trim().length === 0}
                style={[styles.btn, (mcq ? selected === null : textAnswer.trim().length === 0) && styles.btnDisabled]}
              >
                <Text style={styles.btnText}>Check answer</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleNext} style={styles.btn}>
                <Text style={styles.btnText}>
                  {qIdx + 1 >= queue.length ? 'See results →' : 'Next →'}
                </Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── List view ── */
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
          <Text style={styles.screenTitle}>LinguaScripts</Text>
          <Text style={styles.muted}>Personalised exercises from your saved words</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{due.length}</Text>
            <Text style={styles.statLabel}>Due</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{all.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{completed.length}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>

        {/* Start button */}
        {due.length > 0 ? (
          <Pressable onPress={startSession} style={[styles.btn, { marginHorizontal: 16, marginBottom: 24 }]}>
            <Text style={styles.btnText}>Start session · {Math.min(due.length, 10)} exercises</Text>
          </Pressable>
        ) : (
          <View style={[styles.emptyCard, { marginHorizontal: 16, marginBottom: 24 }]}>
            <Text style={{ color: '#22c55e', fontSize: 18 }}>✓ All caught up!</Text>
            <Text style={styles.muted}>Save words while watching to get new exercises.</Text>
          </View>
        )}

        {/* Grouped lists */}
        {(['red', 'orange', 'green'] as StateGroup[]).map((g) => {
          const items = grouped[g];
          if (items.length === 0) return null;
          return (
            <View key={g} style={{ marginBottom: 16 }}>
              <Text style={styles.groupHeader}>
                {STATE_EMOJI[g]} {STATE_LABEL[g]} ({items.length})
              </Text>
              {items.slice(0, 8).map((e) => (
                <View key={e.id} style={styles.exerciseRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '600' }}>{e.target_word}</Text>
                    <Text style={styles.muted} numberOfLines={1}>
                      {e.sentence.replace('_____', '___')}
                    </Text>
                  </View>
                  {e.completed_at && (
                    <Text style={{ color: '#22c55e', fontSize: 12 }}>✓</Text>
                  )}
                </View>
              ))}
              {items.length > 8 && (
                <Text style={[styles.muted, { paddingHorizontal: 16, paddingBottom: 4 }]}>
                  +{items.length - 8} more
                </Text>
              )}
            </View>
          );
        })}

        {all.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 48 }}>🦎</Text>
            <Text style={{ color: '#fff', fontWeight: '600', marginTop: 12, fontSize: 16 }}>
              No exercises yet
            </Text>
            <Text style={[styles.muted, { textAlign: 'center', marginTop: 6 }]}>
              Watch videos, tap words to save them, and exercises will appear here.
            </Text>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1215' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1215' },
  screenTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  muted: { color: '#64748b', fontSize: 13, marginTop: 2 },
  h1: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 12 },

  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1, backgroundColor: '#131f26', borderRadius: 16,
    padding: 16, alignItems: 'center',
  },
  statNum: { color: '#fff', fontSize: 28, fontWeight: '800' },
  statLabel: { color: '#64748b', fontSize: 13, marginTop: 2 },

  btn: {
    backgroundColor: '#22c55e', borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#1a3a27', opacity: 0.5 },
  btnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },

  groupHeader: { color: '#94a3b8', fontSize: 13, fontWeight: '600', paddingHorizontal: 16, marginBottom: 6 },
  exerciseRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#1a2d35',
  },

  emptyCard: {
    backgroundColor: '#131f26', borderRadius: 20,
    padding: 24, alignItems: 'center',
  },

  // Exercise mode
  wordLabel: { color: '#22c55e', fontSize: 28, fontWeight: '800' },
  sentenceBox: {
    backgroundColor: '#131f26', borderRadius: 16,
    padding: 20,
  },
  sentenceText: { color: '#fff', fontSize: 18, lineHeight: 28 },
  blank: { color: '#22c55e', fontWeight: '700', textDecorationLine: 'underline' },

  option: {
    borderWidth: 2, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 20,
  },

  gapInput: {
    marginTop: 20, backgroundColor: '#131f26',
    borderWidth: 2, borderColor: '#243239',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    color: '#fff', fontSize: 16,
  },

  feedbackBox: {
    marginTop: 16, borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 20,
  },

  progressTrack: {
    height: 4, backgroundColor: '#1e2d35',
    borderRadius: 2, marginTop: 12, overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: '#22c55e', borderRadius: 2 },
});
