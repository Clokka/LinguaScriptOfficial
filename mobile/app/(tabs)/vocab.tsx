import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SavedWord {
  id: string;
  word: string;
  translation: string | null;
  language: string;
  state: 'red' | 'yellow' | 'green';
  created_at: string;
}

const STATE_COLOR: Record<string, string> = {
  green: '#22c55e',
  yellow: '#f59e0b',
  red: '#ef4444',
};

const STATE_LABEL: Record<string, string> = {
  green: 'Known',
  yellow: 'Learning',
  red: 'New',
};

export default function VocabScreen() {
  const { user } = useAuth();
  const [words, setWords] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'green' | 'yellow' | 'red'>('all');

  const fetchWords = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    const query = supabase
      .from('saved_words')
      .select('id, word, translation, language, state, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter !== 'all') query.eq('state', filter);
    const { data } = await query;
    setWords((data as SavedWord[]) ?? []);
    setLoading(false);
  }, [user, filter]);

  useEffect(() => {
    setLoading(true);
    fetchWords();
  }, [fetchWords]);

  const counts = {
    green: words.filter((w) => w.state === 'green').length,
    yellow: words.filter((w) => w.state === 'yellow').length,
    red: words.filter((w) => w.state === 'red').length,
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>Sign in to see vocab</Text>
          <Text style={styles.emptyText}>Words you save while watching appear here.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Vocabulary</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {(['green', 'yellow', 'red'] as const).map((s) => (
          <View key={s} style={styles.statCard}>
            <View style={[styles.statDot, { backgroundColor: STATE_COLOR[s] }]} />
            <Text style={styles.statCount}>{counts[s]}</Text>
            <Text style={styles.statLabel}>{STATE_LABEL[s]}</Text>
          </View>
        ))}
      </View>

      {/* Filter chips */}
      <View style={styles.filters}>
        {(['all', 'green', 'yellow', 'red'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'all' ? 'All' : STATE_LABEL[f]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      ) : words.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="book-outline" size={48} color="#6b7280" />
          <Text style={styles.emptyTitle}>No words yet</Text>
          <Text style={styles.emptyText}>Tap words while watching a video to save them here.</Text>
        </View>
      ) : (
        <FlatList
          data={words}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => (
            <View style={styles.wordRow}>
              <View style={[styles.stateDot, { backgroundColor: STATE_COLOR[item.state] }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.wordText}>{item.word}</Text>
                {item.translation && (
                  <Text style={styles.translationText}>{item.translation}</Text>
                )}
              </View>
              <Text style={styles.langBadge}>{item.language}</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '700', color: '#f0fdf4', letterSpacing: -0.5 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  statDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 6 },
  statCount: { fontSize: 22, fontWeight: '700', color: '#f0fdf4' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  filters: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  chipActive: { backgroundColor: '#22c55e', borderColor: '#22c55e' },
  chipText: { fontSize: 13, color: '#9ca3af', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  separator: { height: 1, backgroundColor: '#1f2937' },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  stateDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  wordText: { fontSize: 16, fontWeight: '600', color: '#f0fdf4' },
  translationText: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  langBadge: {
    fontSize: 11,
    color: '#6b7280',
    backgroundColor: '#1f2937',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 999,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#f0fdf4', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#6b7280', textAlign: 'center', lineHeight: 20 },
});
