import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
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

type Row = SavedWordLite & { translation?: string | null };

const stateColor = (s: string) =>
  s === 'green' ? '#22c55e' : s === 'orange' ? '#f59e0b' : '#ef4444';

export default function VocabularyScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams<{ addWord?: string; lang?: string }>();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [lang, setLang] = useState<string>('es');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const p = await fetchProfile(supabase, user.id);
    const language = p?.active_language ?? 'es';
    setLang(language);
    const idx = await loadDeckIndex(supabase, user.id, language);
    const list = Array.from(idx.values()) as Row[];
    const { data } = await supabase
      .from('saved_words')
      .select('id, translation')
      .in('id', list.map((r) => r.id));
    const trans = new Map((data ?? []).map((r: any) => [r.id, r.translation]));
    setRows(list.map((r) => ({ ...r, translation: trans.get(r.id) ?? null })));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Handle share-to-LinguaScript: URL param addWord adds it directly
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

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(
      (r) =>
        r.word.toLowerCase().includes(query) ||
        (r.translation ?? '').toLowerCase().includes(query),
    );
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
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top']}>
      <View className="px-4 pt-2 pb-3">
        <Text className="text-white text-2xl font-bold">Vocabulary</Text>
        <Text className="text-slate-400 text-sm mt-1">
          {rows.length} words · {lang.toUpperCase()}
        </Text>
        <TextInput
          value={q}
          onChangeText={(t) => {
            setQ(t);
            if (t.length === 1 || t.length === 0) selection();
          }}
          placeholder="Search"
          placeholderTextColor="#64748b"
          className="bg-ink-card border border-ink-border rounded-2xl px-4 py-3 mt-3 text-white"
        />
      </View>

      <FlashList
        data={filtered}
        keyExtractor={(r) => r.id}
        estimatedItemSize={72}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        renderItem={({ item }) => (
          <View className="bg-ink-card border border-ink-border rounded-2xl p-4 mb-2 flex-row items-center">
            <View
              className="w-2 h-10 rounded-full mr-3"
              style={{ backgroundColor: stateColor(item.state) }}
            />
            <View className="flex-1">
              <Text className="text-white text-base font-semibold">{item.word}</Text>
              {item.translation ? (
                <Text className="text-slate-400 text-sm">{item.translation}</Text>
              ) : null}
            </View>
            <Pressable
              onPress={() => {
                tapLight();
                shareWord(item.word, item.translation);
              }}
              className="px-3 py-2 mr-1"
            >
              <Text className="text-slate-400 text-lg">↗</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)} className="px-3 py-2">
              <Text className="text-slate-500 text-lg">×</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center py-16">
            <Text className="text-slate-500 text-center">
              No words yet — save some while you watch.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
