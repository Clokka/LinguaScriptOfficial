import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Lesson {
  id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  last_watched_at: string;
  progress_percent: number;
}

interface CatalogRow {
  id: string;
  title: string;
  films: Film[];
}

interface Film {
  id: string;
  title: string;
  thumbnail_url: string | null;
  language: string;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [catalogRows, setCatalogRows] = useState<CatalogRow[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pasteUrl, setPasteUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchLessons = useCallback(async () => {
    if (!user) {
      setLoadingLessons(false);
      return;
    }
    const { data } = await supabase
      .from('user_lessons')
      .select('id, youtube_id, title, thumbnail_url, last_watched_at, progress_percent')
      .eq('user_id', user.id)
      .order('last_watched_at', { ascending: false })
      .limit(20);
    setLessons((data as Lesson[]) ?? []);
    setLoadingLessons(false);
  }, [user]);

  const fetchCatalog = useCallback(async () => {
    const { data: rows } = await supabase
      .from('catalog_rows')
      .select('id, title')
      .order('sort_order')
      .limit(5);
    if (!rows) return;

    const withFilms = await Promise.all(
      rows.map(async (row: { id: string; title: string }) => {
        const { data: pins } = await supabase
          .from('catalog_row_films')
          .select('films(id, title, thumbnail_url, language)')
          .eq('row_id', row.id)
          .order('sort_order')
          .limit(10);
        const films = (pins ?? [])
          .map((p: any) => p.films)
          .filter((f: any) => f?.is_public !== false);
        return { id: row.id, title: row.title, films };
      })
    );
    setCatalogRows(withFilms.filter((r) => r.films.length > 0));
  }, []);

  useEffect(() => {
    fetchLessons();
    fetchCatalog();
  }, [fetchLessons, fetchCatalog]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLessons(), fetchCatalog()]);
    setRefreshing(false);
  };

  const openYouTubeId = async (ytId: string) => {
    const url = `https://www.youtube.com/watch?v=${ytId}`;
    Linking.openURL(url);
  };

  const addLesson = async () => {
    if (!user || !pasteUrl.trim()) return;
    const match = pasteUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([^&?\s#]+)/
    );
    if (!match) return;
    const ytId = match[1];
    setAdding(true);
    try {
      const { data: existing } = await supabase
        .from('user_lessons')
        .select('id')
        .eq('user_id', user.id)
        .eq('youtube_id', ytId)
        .maybeSingle();
      if (!existing) {
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`
        );
        const meta = res.ok ? await res.json() : {};
        await supabase.from('user_lessons').insert({
          user_id: user.id,
          youtube_id: ytId,
          title: meta.title || 'YouTube Video',
          thumbnail_url: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          original_language: 'fr',
        });
      }
      setPasteUrl('');
      fetchLessons();
    } finally {
      setAdding(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>LinguaScript</Text>
            <Text style={styles.subGreeting}>Keep learning. Stay green. 🦎</Text>
          </View>
        </View>

        {/* Add lesson */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add a YouTube Lesson</Text>
          <View style={styles.row}>
            <TextInput
              style={styles.input}
              placeholder="Paste a YouTube link…"
              placeholderTextColor="#6b7280"
              value={pasteUrl}
              onChangeText={setPasteUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.addBtn, (!pasteUrl.trim() || adding) && styles.addBtnDisabled]}
              onPress={addLesson}
              disabled={!pasteUrl.trim() || adding}
            >
              {adding ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="add" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Continue watching */}
        {user && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Continue Watching</Text>
            {loadingLessons ? (
              <ActivityIndicator color="#22c55e" style={{ marginTop: 12 }} />
            ) : lessons.length === 0 ? (
              <Text style={styles.empty}>No lessons yet — add one above!</Text>
            ) : (
              <FlatList
                data={lessons}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(item) => item.id}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.lessonCard}
                    onPress={() => openYouTubeId(item.youtube_id)}
                  >
                    {item.thumbnail_url ? (
                      <Image
                        source={{ uri: item.thumbnail_url }}
                        style={styles.thumbnail}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                        <Ionicons name="play" size={24} color="#6b7280" />
                      </View>
                    )}
                    {item.progress_percent > 0 && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${item.progress_percent}%` }]} />
                      </View>
                    )}
                    <Text style={styles.lessonTitle} numberOfLines={2}>{item.title}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        )}

        {/* Catalog rows */}
        {catalogRows.map((row) => (
          <View key={row.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{row.title}</Text>
            <FlatList
              data={row.films}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.lessonCard}
                  onPress={() => Linking.openURL(`https://linguascript.co.uk/watch/${item.id}`)}
                >
                  {item.thumbnail_url ? (
                    <Image
                      source={{ uri: item.thumbnail_url }}
                      style={styles.thumbnail}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                      <Ionicons name="play" size={24} color="#6b7280" />
                    </View>
                  )}
                  <Text style={styles.lessonTitle} numberOfLines={2}>{item.title}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        ))}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greeting: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f0fdf4',
    letterSpacing: -0.5,
  },
  subGreeting: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e5e7eb',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1f2e',
    borderColor: '#2d3748',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f0fdf4',
    fontSize: 14,
  },
  addBtn: {
    backgroundColor: '#22c55e',
    width: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  lessonCard: {
    width: 160,
  },
  thumbnail: {
    width: 160,
    height: 90,
    borderRadius: 10,
    backgroundColor: '#1a1f2e',
    marginBottom: 6,
  },
  thumbnailPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBar: {
    height: 3,
    backgroundColor: '#374151',
    borderRadius: 2,
    marginTop: -8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  lessonTitle: {
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 16,
  },
  empty: {
    color: '#6b7280',
    fontSize: 14,
    fontStyle: 'italic',
    marginTop: 4,
  },
});
