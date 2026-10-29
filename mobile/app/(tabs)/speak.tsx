// 🗣️ Pillar 3 — SPEAKING. Ramble for 1, 2 or 3 minutes (3 is the target).
// Your newest red flashcards sit on screen; say one and it lights up.
// Common words show green, red-deck words red, as you speak.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import {
  COLOUR_HEX, SPEECH_LANG, colourOf, fetchProfile, loadPillarDeck, normalizeToken, promoteUsedWord, tokenize,
  type PillarDeck,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { success as hapticSuccess, tapLight, tapMedium } from '@/native/haptics';
import { UI } from '@/lib/deck-colors';

const OPTIONS = [1, 2, 3] as const;
const TARGET = 3;

export default function SpeakScreen() {
  const { user } = useAuth();
  const [lang, setLang] = useState<string | null>(null);
  const [deck, setDeck] = useState<PillarDeck | null>(null);
  const [minutes, setMinutes] = useState<number>(TARGET);
  const [phase, setPhase] = useState<'ready' | 'live' | 'done'>('ready');
  const [left, setLeft] = useState(TARGET * 60);
  const [finalText, setFinalText] = useState('');
  const [interim, setInterim] = useState('');
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [promoted, setPromoted] = useState<Record<string, string>>({});
  const [best, setBest] = useState(0);
  const [micError, setMicError] = useState(false);

  const live = useRef(false);
  const startedAt = useRef(0);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const p = await fetchProfile(supabase, user.id);
      const l = p?.learning_language ?? 'fr';
      setLang(l);
      setBest(Number((await AsyncStorage.getItem(`ls.speak.best.${l}`)) || 0));
      setDeck(await loadPillarDeck(supabase, user.id, l));
    })().catch(() => {});
  }, [user]);

  const targets = useMemo(() => (deck ? deck.red.slice(0, 8) : []), [deck]);
  const targetKeys = useMemo(() => new Map(targets.map((w) => [normalizeToken(w.word), w])), [targets]);

  const scan = useCallback((text: string) => {
    const hits = tokenize(text).filter((p) => p.word).map((p) => normalizeToken(p.text)).filter((k) => targetKeys.has(k));
    if (!hits.length) return;
    setUsed((prev) => {
      const fresh = hits.filter((h) => !prev.has(h));
      if (!fresh.length) return prev;
      hapticSuccess();
      const n = new Set(prev);
      fresh.forEach((h) => n.add(h));
      return n;
    });
  }, [targetKeys]);

  const listen = useCallback(() => {
    if (!lang) return;
    ExpoSpeechRecognitionModule.start({
      lang: SPEECH_LANG[lang] ?? 'fr-FR',
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      addsPunctuation: false,
    });
  }, [lang]);

  useSpeechRecognitionEvent('result', (e) => {
    const t = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      setFinalText((prev) => prev + t + ' ');
      setInterim('');
    } else setInterim(t);
    scan(t);
  });
  // Recognition stops after a pause (always on older Android) — keep going until time's up.
  useSpeechRecognitionEvent('end', () => { if (live.current) setTimeout(() => live.current && listen(), 150); });
  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'not-allowed') { setMicError(true); stop(); setPhase('ready'); }
  });

  const stop = () => {
    live.current = false;
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    try { ExpoSpeechRecognitionModule.stop(); } catch { /* not running */ }
  };

  const finish = useCallback(async () => {
    stop();
    setPhase('done');
    setInterim('');
    const secs = Math.min(minutes * 60, Math.round((Date.now() - startedAt.current) / 1000));
    if (lang && secs > best) { setBest(secs); AsyncStorage.setItem(`ls.speak.best.${lang}`, String(secs)).catch(() => {}); }
    if (secs >= TARGET * 60) hapticSuccess();
    if (user) {
      const next: Record<string, string> = {};
      for (const k of used) {
        const w = targetKeys.get(k);
        if (w) next[w.word] = await promoteUsedWord(supabase, user.id, w);
      }
      setPromoted(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [minutes, used, user, targetKeys, lang, best]);
  const finishRef = useRef(finish);
  finishRef.current = finish;

  const start = async () => {
    tapMedium();
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) { setMicError(true); return; }
    setMicError(false);
    setFinalText(''); setInterim(''); setUsed(new Set()); setPromoted({});
    setLeft(minutes * 60);
    startedAt.current = Date.now();
    live.current = true;
    setPhase('live');
    listen();
    tick.current = setInterval(() => {
      const s = minutes * 60 - Math.floor((Date.now() - startedAt.current) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) finishRef.current();
    }, 250);
  };

  useEffect(() => () => stop(), []);

  if (!deck) return <SafeAreaView style={st.screen}><ActivityIndicator color={COLOUR_HEX.green} style={{ marginTop: 80 }} /></SafeAreaView>;

  const total = minutes * 60;
  const elapsed = phase === 'ready' ? 0 : total - left;
  const tier = used.size >= 3 || (phase === 'done' && elapsed >= TARGET * 60) ? 'green' : used.size ? 'orange' : 'red';
  const R = 80;
  const C = 2 * Math.PI * R;
  const spoken = finalText + interim;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <SafeAreaView style={st.screen} edges={['top']}>
      <ScrollView contentContainerStyle={st.content}>
        <View style={{ alignItems: 'center', gap: 14 }}>
          <View style={{ width: 190, height: 190 }}>
            <Svg width={190} height={190} viewBox="0 0 190 190" style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
              <Circle cx={95} cy={95} r={R} stroke={UI.border} strokeWidth={10} fill="none" />
              <Circle cx={95} cy={95} r={R} stroke={COLOUR_HEX[tier]} strokeWidth={10} fill="none" strokeLinecap="round"
                strokeDasharray={`${C}`} strokeDashoffset={C * (1 - Math.min(1, elapsed / total))} />
            </Svg>
            <View style={st.ringCenter}>
              <Text style={{ fontSize: 40 }}>🦎</Text>
              <Text style={[st.time, { color: COLOUR_HEX[tier] }]}>{phase === 'ready' ? `${minutes}:00` : fmt(left)}</Text>
            </View>
          </View>

          {phase !== 'live' ? (
            <View style={st.row}>
              {OPTIONS.map((m) => (
                <Pressable key={m} onPress={() => { tapLight(); setMinutes(m); setLeft(m * 60); }} style={[st.opt, minutes === m && st.optOn]}>
                  <Text style={st.optText}>{m}′</Text>
                  {m === TARGET ? <Text style={st.target}>🎯</Text> : null}
                </Pressable>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={phase === 'live' ? () => finish() : start}
            style={[st.mic, { backgroundColor: phase === 'live' ? UI.surface : COLOUR_HEX.green, borderColor: COLOUR_HEX.green }]}
            accessibilityLabel={phase === 'live' ? 'Stop' : 'Start speaking'}
          >
            <Text style={{ fontSize: 28 }}>{phase === 'live' ? '⏹' : phase === 'done' ? '↻' : '🎙️'}</Text>
          </Pressable>
          {micError ? <Text style={{ color: COLOUR_HEX.red }}>🎙️ ✕</Text> : null}
        </View>

        {targets.length ? (
          <View style={st.wrap}>
            {targets.map((w) => {
              const k = normalizeToken(w.word);
              const on = used.has(k);
              const c = COLOUR_HEX[(promoted[w.word] as keyof typeof COLOUR_HEX) || 'red'];
              return (
                <View key={w.id} style={[st.chip, { borderColor: c, backgroundColor: on ? c : c + '22' }]}>
                  <Text style={[st.chipWord, { color: on ? '#08080B' : c }]}>{on ? '✓ ' : ''}{w.word}</Text>
                  {w.translation ? <Text style={[st.chipSub, { color: on ? '#08080B' : c }]}>{w.translation}</Text> : null}
                </View>
              );
            })}
          </View>
        ) : (
          <Pressable onPress={() => router.push('/(tabs)/discover')} style={[st.box, { alignItems: 'center' }]}>
            <Text style={{ color: UI.text, fontSize: 18 }}>🔴 0 → 📖🎬</Text>
          </Pressable>
        )}

        {phase !== 'ready' || spoken ? (
          <ScrollView ref={scroll} style={[st.box, { maxHeight: 260 }]} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}>
            <Text style={st.transcript}>
              {spoken.trim()
                ? tokenize(spoken).map((p, i) => {
                    if (!p.word) return <Text key={i}>{p.text}</Text>;
                    const c = targetKeys.has(normalizeToken(p.text)) ? 'red' : colourOf(deck, p.text);
                    return <Text key={i} style={c ? { color: COLOUR_HEX[c], fontWeight: c === 'red' ? '800' : '500' } : undefined}>{p.text}</Text>;
                  })
                : '🎙️ …'}
            </Text>
          </ScrollView>
        ) : null}

        {phase === 'done' ? (
          <View style={st.row}>
            <Stat value={fmt(elapsed)} label="⏱" good={elapsed >= TARGET * 60} />
            <Stat value={String(tokenize(finalText).filter((p) => p.word).length)} label="💬" />
            <Stat value={`${used.size}/${targets.length}`} label="🔴→🟠" good={used.size > 0} />
          </View>
        ) : best > 0 ? (
          <Text style={{ color: UI.textMuted, textAlign: 'center' }}>🏆 {fmt(best)}</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ value, label, good }: { value: string; label: string; good?: boolean }) {
  return (
    <View style={[st.box, { flex: 1, alignItems: 'center', paddingVertical: 12 }]}>
      <Text style={{ color: good ? COLOUR_HEX.green : UI.text, fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text style={{ color: UI.textMuted }}>{label}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  content: { padding: 16, gap: 18, paddingBottom: 48 },
  row: { flexDirection: 'row', gap: 10 },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  time: { fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] },
  opt: { width: 64, height: 48, borderRadius: 16, borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center' },
  optOn: { borderColor: COLOUR_HEX.green, backgroundColor: 'rgba(52,199,89,0.15)' },
  optText: { color: UI.text, fontSize: 18, fontWeight: '800' },
  target: { position: 'absolute', top: -8, right: -6, fontSize: 14 },
  mic: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  chip: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipWord: { fontSize: 16, fontWeight: '800' },
  chipSub: { fontSize: 12, opacity: 0.85 },
  box: { borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface, borderRadius: 20, padding: 14 },
  transcript: { color: UI.text, fontSize: 19, lineHeight: 28 },
});
