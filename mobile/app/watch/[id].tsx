import { View, Text, Pressable, ActivityIndicator, Linking as RNLinking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { tapLight } from '@/native/haptics';

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [film, setFilm] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase
      .from('films')
      .select('id, title, youtube_id, description, cefr_level, language')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setFilm(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-ink px-4" edges={['top']}>
      <Pressable onPress={() => router.back()} className="py-3">
        <Text className="text-chameleon">← Back</Text>
      </Pressable>
      <Text className="text-white text-2xl font-bold">{film?.title ?? 'Untitled'}</Text>
      {film?.cefr_level && (
        <Text className="text-slate-400 mt-1">Level: {film.cefr_level}</Text>
      )}
      <Text className="text-slate-400 mt-4">{film?.description ?? ''}</Text>

      <View className="mt-8 bg-ink-card border border-ink-border rounded-2xl p-6">
        <Text className="text-white font-semibold text-lg">Watch coming to mobile</Text>
        <Text className="text-slate-400 mt-2">
          The in-app YouTube player with dual subtitles and tap-to-save is on the roadmap for the
          next release. For now you can open the video on youtube.com and use the web app to save
          words.
        </Text>
        {film?.youtube_id && (
          <Pressable
            onPress={() => {
              tapLight();
              RNLinking.openURL(`https://youtube.com/watch?v=${film.youtube_id}`);
            }}
            className="bg-chameleon rounded-2xl py-3 items-center mt-4"
          >
            <Text className="text-ink font-semibold">Open on YouTube</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}
