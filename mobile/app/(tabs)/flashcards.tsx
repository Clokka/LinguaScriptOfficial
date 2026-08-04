import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
} from 'react-native-reanimated';
import {
  loadDueCards,
  submitReview,
  fetchProfile,
  logXpEvent,
  logActivity,
  XP_REWARDS,
  type SavedWordLite,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  tapLight,
  tapMedium,
  success as hapticSuccess,
  warning as hapticWarning,
  selection,
} from '@/native/haptics';

const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(360, width - 32);

const stateColor = (s: SavedWordLite['state']) =>
  s === 'green' ? '#22c55e' : s === 'orange' ? '#f59e0b' : '#ef4444';

const stateLabel = (s: SavedWordLite['state']) =>
  s === 'green' ? 'Recognized' : s === 'orange' ? 'Learning' : 'Unknown';

export default function FlashcardsScreen() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<SavedWordLite[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [completedCount, setCompletedCount] = useState(0);

  const flip = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const translateX = useSharedValue(0);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const p = await fetchProfile(supabase, user.id);
    const lang = p?.active_language ?? 'es';
    const cards = await loadDueCards(supabase, user.id, lang, 30);
    setQueue(cards);
    setI(0);
    setFlipped(false);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const card = queue[i];

  const onFlip = () => {
    selection();
    flip.value = withTiming(flipped ? 0 : 1, { duration: 300 });
    setFlipped((f) => !f);
  };

  const advance = useCallback(() => {
    setFlipped(false);
    flip.value = 0;
    translateX.value = 0;
    opacity.value = 1;
    scale.value = 1;
    setI((n) => n + 1);
  }, [flip, opacity, scale, translateX]);

  const grade = async (correct: boolean) => {
    if (!card || !user) return;
    correct ? hapticSuccess() : hapticWarning();
    const targetX = correct ? width : -width;
    translateX.value = withTiming(targetX, { duration: 220 });
    opacity.value = withTiming(0, { duration: 220 });
    scale.value = withSequence(withTiming(1.05, { duration: 100 }), withTiming(0.9, { duration: 120 }));
    setCompletedCount((c) => c + 1);
    submitReview(supabase, card, correct).catch(() => {});
    if (correct) {
      logXpEvent(supabase, {
        user_id: user.id,
        amount: XP_REWARDS.FLASHCARD_CORRECT,
        source: 'flashcard_correct',
      }).catch(() => {});
      logActivity(supabase, user.id, 'flashcard').catch(() => {});
    }
    setTimeout(() => runOnJS(advance)(), 240);
  };

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${flip.value * 180}deg` },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    backfaceVisibility: 'hidden',
  }));

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${flip.value * 180 + 180}deg` },
      { translateX: translateX.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  }));

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center">
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView className="flex-1 bg-ink items-center justify-center px-6">
        <Text className="text-6xl mb-4">🦎✨</Text>
        <Text className="text-white text-2xl font-bold text-center">All caught up</Text>
        <Text className="text-slate-400 mt-2 text-center">
          {completedCount > 0
            ? `You reviewed ${completedCount} card${completedCount === 1 ? '' : 's'} today.`
            : 'No cards due right now — save more words while you watch to fill your deck.'}
        </Text>
        <Pressable
          onPress={load}
          className="bg-ink-card border border-ink-border rounded-2xl px-6 py-3 mt-8"
        >
          <Text className="text-white">Refresh</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const translation = (card as any).translation ?? '—';

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={['top']}>
      <View className="px-4 flex-row items-center justify-between mt-2">
        <Text className="text-slate-400">
          {i + 1} / {queue.length}
        </Text>
        <View
          className="px-3 py-1 rounded-full"
          style={{ backgroundColor: stateColor(card.state) + '22' }}
        >
          <Text style={{ color: stateColor(card.state) }} className="text-xs font-semibold">
            {stateLabel(card.state)}
          </Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center px-4">
        <Pressable onPress={onFlip} style={{ width: CARD_WIDTH, height: 300 }}>
          <Animated.View
            style={[
              {
                width: CARD_WIDTH,
                height: 300,
                borderRadius: 24,
                backgroundColor: '#182428',
                borderWidth: 1,
                borderColor: '#243239',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              },
              frontStyle,
            ]}
          >
            <Text className="text-slate-500 text-xs uppercase tracking-widest">Word</Text>
            <Text className="text-white text-4xl font-bold mt-3 text-center">
              {card.word}
            </Text>
            <Text className="text-slate-500 text-xs mt-6">Tap to reveal</Text>
          </Animated.View>

          <Animated.View
            style={[
              {
                width: CARD_WIDTH,
                height: 300,
                borderRadius: 24,
                backgroundColor: '#182428',
                borderWidth: 1,
                borderColor: '#22c55e33',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 24,
              },
              backStyle,
            ]}
          >
            <Text className="text-chameleon text-xs uppercase tracking-widest">
              Translation
            </Text>
            <Text className="text-white text-3xl font-semibold mt-3 text-center">
              {translation}
            </Text>
            <Text className="text-slate-500 text-xs mt-6">Did you know it?</Text>
          </Animated.View>
        </Pressable>
      </View>

      <View className="px-4 pb-8 flex-row gap-3">
        <Pressable
          onPress={() => {
            tapMedium();
            grade(false);
          }}
          className="flex-1 rounded-2xl py-5 items-center bg-red-500/15 border border-red-500/40"
        >
          <Text className="text-red-400 font-semibold text-base">Missed it</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            tapLight();
            grade(true);
          }}
          className="flex-1 rounded-2xl py-5 items-center bg-chameleon"
        >
          <Text className="text-ink font-semibold text-base">Got it</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
