import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  SectionList,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import {
  fetchProfile,
  loadDeckIndex,
  type SavedWordLite,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { tapLight, selection } from '@/native/haptics';
import { shareWord } from '@/native/share';

type Row = SavedWordLite & { translation?: string | null; ipa?: string | null };

type Section = {
  state: 'red' | 'orange' | 'green';
  title: string;
  data: Row[];
};

const STATE_COLOR = { red: '#ef4444', orange: '#f59e0b', green: '#22c55e' } as const;
const STATE_BG    = { red: '#450a0a', orange: '#431407', green: '#14532d' } as const;
const STATE_LABEL = { red: 'Unknown', orange: 'Learning', green: 'Recognised' } as const;
const STATE_EMOJI = { red: '🔴', orange: '🟠', green: '🟢' } as const;

export default function VocabularyScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ addWord?: string; lang?: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<string>('es');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const p = await fetchProfile(supabase, user.id);
    const language = p?.learning_language ?? 'es';
    setLang(language);
    const idx = await loadDeckIndex(supabase, user.id, language);
    const list = Array.from(idx.values()) as Row[];
    const { data } = await supabase
      .from('saved_words')
      .select('id, translation, ipa')
      .in('id', list.map((r) => r.id));
    const extra = new Map<string, { translation: string | null; ipa: string | null }>(
      (data ?? []).map((r: any) => [r.id as string, { translation: r.translation ?? null, ipa: r.ipa ?? null }]),
    );
    setRows(list.map((r) => ({
      ...r,
      translation: extra.get(r.id)?.translation ?? null,
      ipa: extra.get(r.id)?.ipa ?? null,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    async function addFromParam() {
      if (!params.addWord || !user) return;
      const language = (params.lang as string) || lang;
      await supabase.from('saved_words').insert({
        user_id: user.id,
        word: String(params.addWord).trim(),
        language,
        state: 'red',
      });
      load();
    }
    addFromParam();
  }, [params.addWord]);

  const sections = useMemo<Section[]>(() => {
    const query = q.trim().toLowerCase();
    const filter = (r: Row) =>
      !query ||
      r.word.toLowerCase().includes(query) ||
      (r.translation ?? '').toLowerCase().includes(query);

    const red    = rows.filter((r) => r.state === 'red'    && filter(r));
    const orange = rows.filter((r) => r.state === 'orange' && filter(r));
    const green  = rows.filter((r) => r.state === 'green'  && filter(r));

    const result: Section[] = [];
    if (red.length)    result.push({ state: 'red',    title: 'Unknown',    data: red });
    if (orange.length) result.push({ state: 'orange', title: 'Learning',   data: orange });
    if (green.length)  result.push({ state: 'green',  title: 'Recognised', data: green });
    return result;
  }, [rows, q]);

  const remove = async (row: Row) => {
    Alert.alert('Delete word', `Remove "${row.word}" from your vocab?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('saved_words').delete().eq('id', row.id);
          setRows((prev) => prev.filter((r) => r.id !== row.id));
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  const total = rows.length;

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Vocabulary</Text>
          <Text style={s.subtitle}>{total} word{total !== 1 ? 's' : ''} · {lang.toUpperCase()}</Text>
        </View>
        {/* Per-state counts */}
        <View style={s.statRow}>
          {(['red', 'orange', 'green'] as const).map((st) => {
            const count = rows.filter((r) => r.state === st).length;
            if (count === 0) return null;
            return (
              <View key={st} style={[s.statPill, { backgroundColor: STATE_BG[st] }]}>
                <Text style={{ color: STATE_COLOR[st], fontSize: 12, fontWeight: '700' }}>
                  {STATE_EMOJI[st]} {count}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <TextInput
          value={q}
          onChangeText={(t) => { setQ(t); if (t.length === 1 || t.length === 0) selection(); }}
          placeholder="Search words or translations"
          placeholderTextColor="#64748b"
          style={s.searchInput}
        />
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={s.listContent}
        renderSectionHeader={({ section }) => (
          <View style={[s.sectionHeader, { borderLeftColor: STATE_COLOR[section.state] }]}>
            <Text style={[s.sectionTitle, { color: STATE_COLOR[section.state] }]}>
              {STATE_EMOJI[section.state]} {STATE_LABEL[section.state]}
            </Text>
            <View style={[s.sectionBadge, { backgroundColor: STATE_BG[section.state] }]}>
              <Text style={[s.sectionCount, { color: STATE_COLOR[section.state] }]}>
                {section.data.length}
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[s.card, { borderLeftColor: STATE_COLOR[item.state as keyof typeof STATE_COLOR] }]}>
            <View style={s.cardBody}>
              <Text style={[s.word, { color: STATE_COLOR[item.state as keyof typeof STATE_COLOR] }]}>
                {item.word}
              </Text>
              {item.ipa ? <Text style={s.ipa}>{item.ipa}</Text> : null}
              {item.translation ? <Text style={s.translation}>{item.translation}</Text> : null}
            </View>
            <Pressable onPress={() => { tapLight(); shareWord(item.word, item.translation); }} style={s.iconBtn}>
              <Text style={s.iconTxt}>↗</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)} style={s.iconBtn}>
              <Text style={s.iconTxt}>×</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={{ fontSize: 56 }}>📚</Text>
            <Text style={s.emptyText}>
              {q ? 'No words match your search.' : 'No words yet — save some while you watch.'}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0b1215' },
  center: { flex: 1, backgroundColor: '#0b1215', alignItems: 'center', justifyContent: 'center' },

  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  title:  { color: '#fff', fontSize: 26, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 13, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 140 },
  statPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },

  searchWrap: { paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: {
    backgroundColor: '#111c22', borderWidth: 1.5, borderColor: '#243239',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    color: '#fff', fontSize: 15,
  },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderLeftWidth: 3, paddingLeft: 12, paddingVertical: 6,
    marginTop: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  sectionBadge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  sectionCount: { fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: '#111c22', borderRadius: 16,
    borderWidth: 1, borderColor: '#1e2d35',
    borderLeftWidth: 3,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingLeft: 14, paddingRight: 4,
    marginBottom: 8,
  },
  cardBody: { flex: 1 },
  word:        { color: '#fff', fontSize: 17, fontWeight: '700' },
  ipa:         { color: '#64748b', fontSize: 13, marginTop: 1 },
  translation: { color: '#94a3b8', fontSize: 14, marginTop: 2 },

  iconBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  iconTxt: { color: '#475569', fontSize: 18 },

  empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
  emptyText: { color: '#475569', textAlign: 'center', fontSize: 15, lineHeight: 22 },
});
