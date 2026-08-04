import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Image,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
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
import { tapLight } from '@/native/haptics';

function ContentCard({ film, onPress }: { film: FilmRow; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="w-40 mr-3"
      onPressIn={tapLight}
    >
      <View className="w-40 h-56 rounded-2xl overflow-hidden bg-ink-card border border-ink-border">
        {film.poster_url ? (
          <Image source={{ uri: film.poster_url }} className="w-full h-full" resizeMode="cover" />
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

  const load = useCallback(async () => {
    if (!user) return;
    const p = await fetchProfile(supabase, user.id);
    setProfile(p);
    const lang = p?.active_language ?? 'es';
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

  const streak = profile?.current_streak ?? 0;
  const xp = profile?.xp_total ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top']}>
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

        {due.length > 0 && (
          <Pressable
            onPress={() => router.push('/(tabs)/flashcards')}
            className="mx-4 mt-6 bg-chameleon rounded-2xl p-4 flex-row items-center justify-between"
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
    </SafeAreaView>
  );
}
