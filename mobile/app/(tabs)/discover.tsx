import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LANGUAGES, fetchProfile, type FilmRow } from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { tapLight } from '@/native/haptics';

const { width } = Dimensions.get('window');
const CARD_W = (width - 48) / 2;

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

type Filters = { lang: string | null; level: string | null };

function VideoCard({ film, onPress }: { film: FilmRow; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.card} onPressIn={tapLight}>
      <View style={s.thumb}>
        {film.thumbnail_url
          ? <Image source={{ uri: film.thumbnail_url }} style={s.thumbImg} resizeMode="cover" />
          : (
            <View style={s.thumbPlaceholder}>
              <Text style={{ fontSize: 36 }}>🎬</Text>
            </View>
          )
        }
        {film.cefr_level && (
          <View style={s.cefrBadge}>
            <Text style={s.cefrText}>{film.cefr_level}</Text>
          </View>
        )}
      </View>
      <Text style={s.cardTitle} numberOfLines={2}>{film.title}</Text>
      {film.language && (
        <Text style={s.cardLang}>
          {LANGUAGES.find((l) => l.code === film.language)?.flag ?? '🌐'}{' '}
          {LANGUAGES.find((l) => l.code === film.language)?.label ?? film.language}
        </Text>
      )}
    </Pressable>
  );
}

export default function DiscoverScreen() {
  const { user } = useAuth();
  const router   = useRouter();

  const [films, setFilms]       = useState<FilmRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filters, setFilters]   = useState<Filters>({ lang: null, level: null });
  const [userLang, setUserLang] = useState<string>('es');

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    const p = await fetchProfile(supabase, user.id);
    const defaultLang = p?.learning_language ?? 'es';
    setUserLang(defaultLang);

    // Query public films + the user's own private films
    const { data } = await supabase
      .from('films')
      .select('id, title, thumbnail_url, url, language, cefr_level, duration_seconds, category')
      .or(`is_public.eq.true,created_by.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100);

    setFilms((data as FilmRow[]) ?? []);
    setLoading(false);

    // Default language filter to the user's learning language
    setFilters((f) => ({ ...f, lang: defaultLang }));
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    let rows = films;

    if (filters.lang)  rows = rows.filter((f) => f.language === filters.lang);
    if (filters.level) rows = rows.filter((f) => f.cefr_level === filters.level);

    const q = search.trim().toLowerCase();
    if (q) rows = rows.filter((f) => f.title.toLowerCase().includes(q));

    return rows;
  }, [films, filters, search]);

  const toggleLang = (code: string) =>
    setFilters((f) => ({ ...f, lang: f.lang === code ? null : code }));

  const toggleLevel = (lvl: string) =>
    setFilters((f) => ({ ...f, level: f.level === lvl ? null : lvl }));

  const openFilm = (film: FilmRow) => {
    tapLight();
    router.push({ pathname: '/watch/[id]', params: { id: film.id } });
  };

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Discover</Text>
        <Text style={s.sub}>A curated library — every word is tappable.</Text>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by title…"
          placeholderTextColor="#475569"
          style={s.searchInput}
          returnKeyType="search"
        />
      </View>

      {/* Language chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={LANGUAGES}
        keyExtractor={(l) => l.code}
        contentContainerStyle={s.chipsRow}
        renderItem={({ item }) => {
          const active = filters.lang === item.code;
          return (
            <Pressable
              onPress={() => { tapLight(); toggleLang(item.code); }}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>
                {item.flag} {item.label}
              </Text>
            </Pressable>
          );
        }}
      />

      {/* Level chips */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={LEVELS}
        keyExtractor={(l) => l}
        contentContainerStyle={s.chipsRow}
        renderItem={({ item }) => {
          const active = filters.level === item;
          return (
            <Pressable
              onPress={() => { tapLight(); toggleLevel(item); }}
              style={[s.chip, active && s.chipActive]}
            >
              <Text style={[s.chipText, active && s.chipTextActive]}>{item}</Text>
            </Pressable>
          );
        }}
      />

      {/* Results count */}
      {!loading && (
        <Text style={s.resultCount}>
          {visible.length} video{visible.length !== 1 ? 's' : ''}
          {filters.lang || filters.level || search ? ' matching filters' : ''}
        </Text>
      )}

      {/* Grid */}
      {loading
        ? (
          <View style={s.center}>
            <ActivityIndicator color="#22c55e" />
          </View>
        )
        : (
          <FlatList
            data={visible}
            keyExtractor={(f) => f.id}
            numColumns={2}
            columnWrapperStyle={s.row}
            contentContainerStyle={s.gridContent}
            renderItem={({ item }) => <VideoCard film={item} onPress={() => openFilm(item)} />}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={{ fontSize: 48 }}>🎬</Text>
                <Text style={s.emptyText}>
                  {search || filters.lang || filters.level
                    ? 'No videos match your filters.'
                    : 'No videos yet — paste a YouTube link from the Home tab to add one.'}
                </Text>
              </View>
            }
          />
        )
      }
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0b1215' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },

  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  title:  { color: '#fff', fontSize: 26, fontWeight: '800' },
  sub:    { color: '#64748b', fontSize: 13, marginTop: 2 },

  searchRow:   { paddingHorizontal: 16, paddingVertical: 8 },
  searchInput: {
    backgroundColor: '#111c22', borderWidth: 1.5, borderColor: '#243239',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    color: '#fff', fontSize: 15,
  },

  chipsRow: { paddingHorizontal: 16, paddingBottom: 6, gap: 8 },
  chip: {
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: '#111c22', borderWidth: 1, borderColor: '#243239',
  },
  chipActive:     { backgroundColor: '#14532d', borderColor: '#22c55e' },
  chipText:       { color: '#64748b', fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: '#22c55e' },

  resultCount: { color: '#475569', fontSize: 12, paddingHorizontal: 16, paddingBottom: 4 },

  row:         { paddingHorizontal: 16, gap: 12, marginBottom: 12 },
  gridContent: { paddingTop: 8, paddingBottom: 40 },

  card:  { width: CARD_W },
  thumb: {
    width: CARD_W, height: CARD_W * 0.65,
    borderRadius: 16, overflow: 'hidden',
    backgroundColor: '#111c22',
    borderWidth: 1, borderColor: '#1e2d35',
  },
  thumbImg:         { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cefrBadge: {
    position: 'absolute', bottom: 6, left: 6,
    backgroundColor: '#22c55ecc', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  cefrText:  { color: '#0b1215', fontSize: 11, fontWeight: '800' },
  cardTitle: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 8, lineHeight: 18 },
  cardLang:  { color: '#64748b', fontSize: 11, marginTop: 3 },

  empty:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32, gap: 12 },
  emptyText: { color: '#475569', textAlign: 'center', fontSize: 14, lineHeight: 20 },
});
