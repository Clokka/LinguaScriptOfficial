import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface DueWord {
  id: string;
  word: string;
  translation: string | null;
  language: string;
  state: string;
}

export default function ReviewScreen() {
  const { user } = useAuth();
  const [dueWords, setDueWords] = useState<DueWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  const fetchDueWords = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('saved_words')
      .select('id, word, translation, language, state')
      .eq('user_id', user.id)
      .neq('state', 'green')
      .order('updated_at', { ascending: true })
      .limit(20);
    setDueWords((data as DueWord[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDueWords();
  }, [fetchDueWords]);

  const markWord = async (outcome: 'green' | 'yellow' | 'red') => {
    const word = dueWords[currentIndex];
    if (!word) return;
    await supabase
      .from('saved_words')
      .update({ state: outcome, state_changed_at: new Date().toISOString() })
      .eq('id', word.id);
    const next = currentIndex + 1;
    if (next >= dueWords.length) {
      setSessionDone(true);
    } else {
      setCurrentIndex(next);
      setFlipped(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>Sign in to review</Text>
          <Text style={styles.emptyText}>Your flashcards appear here once you start saving words.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      </SafeAreaView>
    );
  }

  if (sessionDone || dueWords.length === 0) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Text style={styles.successEmoji}>🎉</Text>
          <Text style={styles.emptyTitle}>
            {dueWords.length === 0 ? 'No cards due!' : 'Session complete!'}
          </Text>
          <Text style={styles.emptyText}>
            {dueWords.length === 0
              ? 'Save words while watching videos to build your deck.'
              : `You reviewed ${dueWords.length} cards. Great work!`}
          </Text>
          {dueWords.length > 0 && (
            <TouchableOpacity
              style={styles.restartBtn}
              onPress={() => { setCurrentIndex(0); setFlipped(false); setSessionDone(false); }}
            >
              <Text style={styles.restartBtnText}>Review Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const card = dueWords[currentIndex];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.progress}>{currentIndex + 1} / {dueWords.length}</Text>
        <Text style={styles.title}>Flashcard Review</Text>
      </View>

      <View style={styles.cardWrap}>
        <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => setFlipped(!flipped)}>
          <Text style={styles.cardHint}>{flipped ? 'Translation' : 'Word — tap to reveal'}</Text>
          <Text style={styles.cardWord}>{flipped ? (card.translation ?? '—') : card.word}</Text>
          {!flipped && (
            <Ionicons name="eye-outline" size={20} color="#6b7280" style={{ marginTop: 12 }} />
          )}
        </TouchableOpacity>
      </View>

      {flipped && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionBtn, styles.redBtn]} onPress={() => markWord('red')}>
            <Ionicons name="close" size={24} color="#fff" />
            <Text style={styles.actionLabel}>Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.yellowBtn]} onPress={() => markWord('yellow')}>
            <Ionicons name="remove" size={24} color="#fff" />
            <Text style={styles.actionLabel}>Hard</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.greenBtn]} onPress={() => markWord('green')}>
            <Ionicons name="checkmark" size={24} color="#fff" />
            <Text style={styles.actionLabel}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f0fdf4',
  },
  progress: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  cardWrap: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
    minHeight: 220,
    justifyContent: 'center',
  },
  cardHint: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardWord: {
    fontSize: 36,
    fontWeight: '700',
    color: '#f0fdf4',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  redBtn: { backgroundColor: '#ef4444' },
  yellowBtn: { backgroundColor: '#f59e0b' },
  greenBtn: { backgroundColor: '#22c55e' },
  actionLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f0fdf4',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  successEmoji: {
    fontSize: 48,
  },
  restartBtn: {
    marginTop: 8,
    backgroundColor: '#22c55e',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 999,
  },
  restartBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
