import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
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
const CARD_W = Math.min(360, width - 32);

// Exact colours from web app
const STATE_COLOR = { red: '#ef4444', orange: '#f59e0b', green: '#22c55e' } as const;
const STATE_BG    = { red: '#450a0a', orange: '#431407', green: '#14532d' } as const;
const STATE_LABEL = { red: 'Unknown', orange: 'Learning', green: 'Recognised' } as const;
const STATE_NEXT  = { red: 'orange', orange: 'green', green: 'green' } as const;

type CardFull = SavedWordLite & {
  translation: string | null;
  pronunciation: string | null;
  ipa: string | null;
  context: string | null;
};

async function loadFullCards(
  userId: string,
  language: string,
  limit: number,
): Promise<CardFull[]> {
  const lite = await loadDueCards(supabase, userId, language, limit);
  if (lite.length === 0) return [];
  const { data } = await supabase
    .from('saved_words')
    .select('id, translation, pronunciation, ipa, context')
    .in('id', lite.map((c) => c.id));
  const extra = new Map((data ?? []).map((r: any) => [r.id, r]));
  return lite.map((c) => {
    const e = extra.get(c.id) ?? {};
    return {
      ...c,
      translation: e.translation ?? null,
      pronunciation: e.pronunciation ?? null,
      ipa: e.ipa ?? null,
      context: e.context ?? null,
    } as CardFull;
  });
}

export default function FlashcardsScreen() {
  const { user } = useAuth();
  const [queue, setQueue] = useState<CardFull[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(0);

  const flip   = useSharedValue(0);
  const tx     = useSharedValue(0);
  const scale  = useSharedValue(1);
  const opa    = useSharedValue(1);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const p = await fetchProfile(supabase, user.id);
    const lang = p?.learning_language ?? 'es';
    const cards = await loadFullCards(user.id, lang, 30);
    setQueue(cards);
    setIdx(0);
    setFlipped(false);
    flip.value = 0;
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const card = queue[idx] ?? null;

  const onFlip = () => {
    selection();
    flip.value = withTiming(flipped ? 0 : 1, { duration: 280 });
    setFlipped((f) => !f);
  };

  const advance = useCallback(() => {
    setFlipped(false);
    flip.value = 0;
    tx.value = 0;
    opa.value = 1;
    scale.value = 1;
    setIdx((n) => n + 1);
  }, [flip, tx, opa, scale]);

  const grade = async (correct: boolean) => {
    if (!card || !user) return;
    correct ? hapticSuccess() : hapticWarning();
    tx.value    = withTiming(correct ? width + 40 : -(width + 40), { duration: 220 });
    opa.value   = withTiming(0, { duration: 200 });
    scale.value = withSequence(withTiming(1.04, { duration: 90 }), withTiming(0.92, { duration: 130 }));
    setDone((d) => d + 1);
    submitReview(supabase, card, correct).catch(() => {});
    if (correct) {
      logXpEvent(supabase, { user_id: user.id, amount: XP_REWARDS.FLASHCARD_CORRECT, source: 'flashcard_correct' }).catch(() => {});
      logActivity(supabase, user.id, 'flashcard').catch(() => {});
    }
    setTimeout(() => runOnJS(advance)(), 240);
  };

  const frontAnim = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${flip.value * 180}deg` },
      { translateX: tx.value },
      { scale: scale.value },
    ],
    opacity: opa.value,
    backfaceVisibility: 'hidden',
  }));

  const backAnim = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1200 },
      { rotateY: `${flip.value * 180 + 180}deg` },
      { translateX: tx.value },
      { scale: scale.value },
    ],
    opacity: opa.value,
    backfaceVisibility: 'hidden',
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
  }));

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  if (!card) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={{ fontSize: 64 }}>🦎✨</Text>
        <Text style={s.emptyTitle}>All caught up!</Text>
        <Text style={s.emptySub}>
          {done > 0
            ? `You reviewed ${done} card${done === 1 ? '' : 's'} · great work.`
            : 'No cards due · save words while watching to build your deck.'}
        </Text>
        <Pressable onPress={load} style={s.refreshBtn}>
          <Text style={{ color: '#94a3b8' }}>Refresh</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const color = STATE_COLOR[card.state];
  const bg    = STATE_BG[card.state];
  const label = STATE_LABEL[card.state];
  const next  = STATE_NEXT[card.state];

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Progress bar */}
      <View style={s.progressTrack}>
        <View style={[s.progressFill, { width: `${((idx) / Math.max(queue.length, 1)) * 100}%` }]} />
      </View>

      {/* Counter + state badge */}
      <View style={s.topRow}>
        <Text style={s.counter}>{idx + 1} / {queue.length}</Text>
        <View style={[s.stateBadge, { backgroundColor: bg }]}>
          <View style={[s.stateDot, { backgroundColor: color }]} />
          <Text style={[s.stateText, { color }]}>{label}</Text>
        </View>
      </View>

      {/* Card */}
      <View style={s.cardArea}>
        <Pressable onPress={onFlip} style={{ width: CARD_W, height: 340 }}>

          {/* Front */}
          <Animated.View style={[s.card, frontAnim]}>
            <View style={[s.stateStripe, { backgroundColor: color }]} />
            <View style={s.cardInner}>
              <Text style={s.cardHint}>Word</Text>
              <Text style={[s.cardWord, { color }]}>{card.word}</Text>
              {card.ipa ? <Text style={s.cardIpa}>{card.ipa}</Text> : null}
              <Text style={s.cardHint2}>Tap to reveal →</Text>
            </View>
          </Animated.View>

          {/* Back */}
          <Animated.View style={[s.card, s.cardBack, backAnim]}>
            <View style={[s.stateStripe, { backgroundColor: '#22c55e' }]} />
            <View style={s.cardInner}>
              <Text style={s.cardHint}>Translation</Text>
              <Text style={s.cardTranslation}>{card.translation ?? '—'}</Text>
              {card.pronunciation ? (
                <Text style={s.cardPronunciation}>{card.pronunciation}</Text>
              ) : null}
              {card.context ? (
                <Text style={s.cardContext}>"{card.context}"</Text>
              ) : null}
              <View style={s.nextBadge}>
                <Text style={s.nextText}>
                  ✓ moves to{' '}
                  <Text style={{ color: STATE_COLOR[next as keyof typeof STATE_COLOR] }}>
                    {next}
                  </Text>
                </Text>
              </View>
            </View>
          </Animated.View>

        </Pressable>
      </View>

      {/* Buttons — only show once flipped */}
      {flipped && (
        <View style={s.btnRow}>
          <Pressable
            onPress={() => { tapMedium(); grade(false); }}
            style={[s.btn, s.btnMissed]}
          >
            <Text style={[s.btnEmoji]}>✗</Text>
            <Text style={s.btnLabelRed}>Again</Text>
            <Text style={s.btnSub}>stay {card.state}</Text>
          </Pressable>

          <Pressable
            onPress={() => { tapLight(); grade(true); }}
            style={[s.btn, s.btnGot]}
          >
            <Text style={s.btnEmoji}>✓</Text>
            <Text style={s.btnLabelGreen}>Got it</Text>
            <Text style={s.btnSubGreen}>→ {next}</Text>
          </Pressable>
        </View>
      )}

      {!flipped && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Pressable onPress={onFlip} style={s.flipPrompt}>
            <Text style={{ color: '#22c55e', fontWeight: '700', fontSize: 16 }}>
              Tap card to reveal translation
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: '#0b1215' },
  center: { flex: 1, backgroundColor: '#0b1215', alignItems: 'center', justifyContent: 'center', padding: 24 },

  progressTrack: { height: 3, backgroundColor: '#1e2d35', marginHorizontal: 0 },
  progressFill:  { height: 3, backgroundColor: '#22c55e' },

  topRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  counter:   { color: '#64748b', fontSize: 14 },
  stateBadge: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  stateDot:   { width: 8, height: 8, borderRadius: 4 },
  stateText:  { fontSize: 13, fontWeight: '700' },

  cardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  card: {
    width: CARD_W, height: 340, borderRadius: 24,
    backgroundColor: '#111c22',
    borderWidth: 1, borderColor: '#243239',
    overflow: 'hidden',
  },
  cardBack: { borderColor: '#22c55e33' },
  stateStripe: { height: 4, width: '100%' },
  cardInner: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },

  cardHint:        { color: '#475569', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 },
  cardWord:        { fontSize: 44, fontWeight: '800', textAlign: 'center' },
  cardIpa:         { color: '#64748b', fontSize: 16, marginTop: 6 },
  cardHint2:       { color: '#334155', fontSize: 13, marginTop: 20 },
  cardTranslation: { color: '#fff', fontSize: 34, fontWeight: '700', textAlign: 'center', marginBottom: 6 },
  cardPronunciation: { color: '#94a3b8', fontSize: 16, marginBottom: 4 },
  cardContext:     { color: '#475569', fontSize: 14, fontStyle: 'italic', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  nextBadge:       { position: 'absolute', bottom: 20 },
  nextText:        { color: '#475569', fontSize: 12 },

  btnRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 36 },
  btn:    { flex: 1, borderRadius: 20, paddingVertical: 18, alignItems: 'center' },
  btnMissed: { backgroundColor: '#450a0a', borderWidth: 1, borderColor: '#7f1d1d' },
  btnGot:    { backgroundColor: '#14532d', borderWidth: 1, borderColor: '#166534' },
  btnEmoji:        { fontSize: 22, marginBottom: 4 },
  btnLabelRed:     { color: '#ef4444', fontWeight: '700', fontSize: 16 },
  btnLabelGreen:   { color: '#22c55e', fontWeight: '700', fontSize: 16 },
  btnSub:          { color: '#7f1d1d', fontSize: 12, marginTop: 2 },
  btnSubGreen:     { color: '#166534', fontSize: 12, marginTop: 2 },

  flipPrompt: {
    backgroundColor: '#131f26', borderRadius: 16, borderWidth: 1,
    borderColor: '#22c55e44', paddingVertical: 16, alignItems: 'center',
  },

  emptyTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  emptySub:   { color: '#64748b', textAlign: 'center', marginTop: 8, lineHeight: 22 },
  refreshBtn: {
    marginTop: 32, backgroundColor: '#131f26', borderWidth: 1,
    borderColor: '#243239', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 28,
  },
});
