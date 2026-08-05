import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Modal,
  TextInput,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import {
  fetchDiscoverRail,
  fetchContinueWatching,
  fetchProfile,
  loadDueCards,
  type FilmRow,
  type Profile,
  type SavedWordLite,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { tapLight, tapMedium } from '@/native/haptics';

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,
    /youtu\.be\/([^?#]+)/,
    /embed\/([^?#]+)/,
    /shorts\/([^?#]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

function AddVideoModal({
  visible,
  language,
  userId,
  onClose,
  onAdded,
}: {
  visible: boolean;
  language: string;
  userId: string;
  onClose: () => void;
  onAdded: (filmId: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    const ytId = extractYouTubeId(url.trim());
    if (!ytId) {
      Alert.alert('Invalid URL', 'Paste a valid YouTube link, e.g. https://youtube.com/watch?v=...');
      return;
    }
    setBusy(true);
    tapMedium();

    // Get title via YouTube oEmbed (no API key needed)
    let title = 'Untitled video';
    let thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    try {
      const oembed = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`,
      );
      if (oembed.ok) {
        const j = await oembed.json() as { title?: string; thumbnail_url?: string };
        if (j.title) title = j.title;
        if (j.thumbnail_url) thumbnail = j.thumbnail_url;
      }
    } catch (_) {}

    const filmUrl = `https://www.youtube.com/watch?v=${ytId}`;

    // Check if we already have this film
    const { data: existing } = await supabase
      .from('films')
      .select('id')
      .eq('url', filmUrl)
      .eq('created_by', userId)
      .maybeSingle();

    let filmId = existing?.id as string | undefined;

    if (!filmId) {
      const { data: inserted } = await supabase
        .from('films')
        .insert({
          title,
          url: filmUrl,
          thumbnail_url: thumbnail,
          language,
          is_public: false,
          created_by: userId,
        })
        .select('id')
        .single();
      filmId = inserted?.id;
    }

    if (!filmId) {
      Alert.alert('Error', 'Could not add the video. Try again.');
      setBusy(false);
      return;
    }

    // Upsert user_lessons
    await supabase.from('user_lessons').upsert({
      user_id: userId,
      youtube_id: ytId,
      title,
      thumbnail_url: thumbnail,
      original_language: language,
    }, { onConflict: 'user_id,youtube_id' });

    setBusy(false);
    setUrl('');
    onClose();
    onAdded(filmId);
  };

  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onClose}>
      <Pressable style={addStyles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}}>
          <View style={addStyles.sheet}>
            <View style={addStyles.handle} />
            <Text style={addStyles.title}>Add a YouTube video</Text>
            <Text style={addStyles.subtitle}>Paste any YouTube link to watch it with subtitles and save words</Text>
            <TextInput
              style={addStyles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="https://youtube.com/watch?v=..."
              placeholderTextColor="#475569"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={handleAdd}
            />
            <Pressable
              onPress={handleAdd}
              disabled={busy || url.trim().length === 0}
              style={[addStyles.btn, (busy || url.trim().length === 0) && { opacity: 0.5 }]}
            >
              {busy ? (
                <ActivityIndicator color="#0b1215" />
              ) : (
                <Text style={addStyles.btnText}>Add video →</Text>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const addStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#131f26',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 12, paddingBottom: 48,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#2d4a5a', alignSelf: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '800' },
  subtitle: { color: '#64748b', fontSize: 14, marginTop: 6, marginBottom: 20 },
  input: {
    backgroundColor: '#0b1215', borderWidth: 2, borderColor: '#243239',
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    color: '#fff', fontSize: 15, marginBottom: 16,
  },
  btn: { backgroundColor: '#22c55e', borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#0b1215', fontWeight: '700', fontSize: 16 },
});

function ContentCard({ film, onPress }: { film: FilmRow; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-40 mr-3"
      onPressIn={tapLight}
    >
      <View className="w-40 h-56 rounded-2xl overflow-hidden bg-ink-card border border-ink-border">
        {film.thumbnail_url ? (
          <Image source={{ uri: film.thumbnail_url }} className="w-full h-full" resizeMode="cover" />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="text-5xl">🎬</Text>
          </View>
        )}
      </View>
      <Text className="text-white mt-2 font-medium" numberOfLines={1}>
        {film.title}
      </Text>
      {film.cefr_level && (
        <Text className="text-slate-500 text-xs">{film.cefr_level}</Text>
      )}
    </Pressable>
  );
}

function Rail({
  title,
  data,
  onSelect,
}: {
  title: string;
  data: FilmRow[];
  onSelect: (f: FilmRow) => void;
}) {
  if (data.length === 0) return null;
  return (
    <View className="mt-6">
      <Text className="text-white text-xl font-semibold px-4 mb-3">{title}</Text>
      <FlashList
        horizontal
        data={data}
        keyExtractor={(f) => f.id}
        estimatedItemSize={170}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        renderItem={({ item }) => (
          <ContentCard film={item} onPress={() => onSelect(item)} />
        )}
      />
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [discover, setDiscover] = useState<FilmRow[]>([]);
  const [continueWatching, setContinueWatching] = useState<FilmRow[]>([]);
  const [due, setDue] = useState<SavedWordLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(supabase, user.id);
    setProfile(p);
    const lang = p?.learning_language ?? 'es';
    const [d, cw, dc] = await Promise.all([
      fetchDiscoverRail(supabase, lang),
      fetchContinueWatching(supabase, user.id, lang),
      loadDueCards(supabase, user.id, lang, 50),
    ]);
    setDiscover(d);
    setContinueWatching(cw);
    setDue(dc);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openWatch = (film: FilmRow) => {
    tapLight();
    router.push({ pathname: '/watch/[id]', params: { id: film.id } });
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  const streak = profile?.streak_count ?? 0;
  const xp = profile?.xp_total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top']} style={{ position: 'relative' }}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#22c55e" />
        }
      >
        <View className="px-4 pt-2 flex-row items-center justify-between">
          <View>
            <Text className="text-slate-400 text-sm">Welcome back</Text>
            <Text className="text-white text-2xl font-bold">
              {profile?.display_name ?? 'Learner'}
            </Text>
          </View>
          <View className="flex-row">
            <View className="items-center mr-4">
              <Text className="text-2xl">🔥</Text>
              <Text className="text-white font-semibold">{streak}</Text>
            </View>
            <View className="items-center">
              <Text className="text-2xl">⭐</Text>
              <Text className="text-white font-semibold">{xp}</Text>
            </View>
          </View>
        </View>

        {/* Paste YouTube link card */}
        <Pressable
          onPress={() => { tapLight(); setShowAddModal(true); }}
          className="mx-4 mt-5 bg-ink-card border border-ink-border rounded-2xl px-4 py-3 flex-row items-center"
        >
          <Text className="text-2xl mr-3">▶️</Text>
          <View className="flex-1">
            <Text className="text-white font-semibold text-sm">Add a YouTube video</Text>
            <Text className="text-slate-500 text-xs mt-0.5">Paste a link to watch with subtitles</Text>
          </View>
          <Text className="text-chameleon text-lg">+</Text>
        </Pressable>

        {due.length > 0 && (
          <Pressable
            onPress={() => router.push('/(tabs)/flashcards')}
            className="mx-4 mt-4 bg-chameleon rounded-2xl p-4 flex-row items-center justify-between"
            onPressIn={tapLight}
          >
            <View>
              <Text className="text-ink text-base font-semibold">
                {due.length} card{due.length === 1 ? '' : 's'} ready to review
              </Text>
              <Text className="text-ink/80 text-xs mt-1">
                Tap to keep your streak green
              </Text>
            </View>
            <Text className="text-ink text-xl">→</Text>
          </Pressable>
        )}

        <Rail title="Continue watching" data={continueWatching} onSelect={openWatch} />
        <Rail title="Discover" data={discover} onSelect={openWatch} />

        <View className="h-10" />
      </ScrollView>

      {user && (
        <AddVideoModal
          visible={showAddModal}
          language={profile?.learning_language ?? 'es'}
          userId={user.id}
          onClose={() => setShowAddModal(false)}
          onAdded={(filmId) => {
            router.push({ pathname: '/watch/[id]', params: { id: filmId } });
          }}
        />
      )}
    </SafeAreaView>
  );
}
