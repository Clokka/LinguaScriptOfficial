// ✍️ Pillar 2 — WRITING. 1–2 red words + green words + your hobby → a LinguaScript.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import {
  ABOUT_QUESTION, COLOUR_HEX, INTEREST_EMOJI, checkLinguaScript, colourOf, composeLinguaScript, fetchProfile,
  loadPillarDeck, pickRedPair, promoteUsedWord, tokenize, usesWord,
  type Checked, type Composed, type PillarDeck, type PillarWord,
} from '@linguascript/core';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { success as hapticSuccess, tapLight, warning as hapticWarning } from '@/native/haptics';
import { UI } from '@/lib/deck-colors';

interface Mine { text: string; translation: string; words: string[]; interest: string }

export default function WriteScreen() {
  const { user } = useAuth();
  const [lang, setLang] = useState<string | null>(null);
  const [native, setNative] = useState('en');
  const [interests, setInterests] = useState<string[]>(['travel']);
  const [interest, setInterest] = useState('travel');
  const [about, setAbout] = useState('');
  const [deck, setDeck] = useState<PillarDeck | null>(null);
  const [round, setRound] = useState(0);
  const [pair, setPair] = useState<PillarWord[]>([]);
  const [composed, setComposed] = useState<Composed | null>(null);
  const [composing, setComposing] = useState(false);
  const [hint, setHint] = useState(false);
  const [text, setText] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Checked | null>(null);
  const [promoted, setPromoted] = useState<Record<string, string>>({});
  const [mine, setMine] = useState<Mine[]>([]);
  const req = useRef(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const p = await fetchProfile(supabase, user.id);
      const l = p?.learning_language ?? 'fr';
      setLang(l);
      setNative(p?.native_language ?? 'en');
      const { data } = await supabase.from('profiles').select('interests').eq('user_id', user.id).maybeSingle();
      const ints = ((data as any)?.interests as string[] | undefined)?.length ? (data as any).interests : ['travel'];
      setInterests(ints);
      setInterest(ints[0]);
      setAbout((await AsyncStorage.getItem(`ls.about.${ints[0]}`)) || '');
      setMine(JSON.parse((await AsyncStorage.getItem(`ls.mine.${l}`)) || '[]'));
      setDeck(await loadPillarDeck(supabase, user.id, l));
    })().catch(() => {});
  }, [user]);

  const compose = useCallback(async () => {
    if (!deck || !lang) return;
    const p = pickRedPair(deck.red, round);
    setPair(p); setComposed(null); setResult(null); setHint(false); setText(''); setPromoted({});
    if (!p.length) return;
    const my = ++req.current;
    setComposing(true);
    const c = await composeLinguaScript(supabase, {
      language: lang, nativeLanguage: native, interest, about,
      redWords: p.map((w) => ({ word: w.word, translation: w.translation })),
      greenWords: deck.greenSample,
    }).catch(() => null);
    if (my !== req.current) return;
    setComposed(c);
    setComposing(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, lang, round, interest, native]);

  useEffect(() => { compose(); }, [compose]);

  const greenHints = useMemo(() => (deck ? deck.greenSample.slice(0, 8) : []), [deck]);

  const pickInterest = async (id: string) => {
    tapLight();
    setInterest(id);
    setAbout((await AsyncStorage.getItem(`ls.about.${id}`)) || '');
  };

  const check = async () => {
    if (!user || !lang || !text.trim()) return;
    setChecking(true);
    const r = await checkLinguaScript(supabase, {
      language: lang, nativeLanguage: native, interest, about, text,
      redWords: pair.map((w) => ({ word: w.word, translation: w.translation })),
    }).catch(() => null);
    setChecking(false);
    if (!r) { hapticWarning(); return; }
    setResult(r);
    if (r.score >= 30) {
      hapticSuccess();
      const next: Record<string, string> = {};
      for (const w of pair) {
        if (usesWord(r.corrected || text, w.word) || r.usedWords.some((u) => u.toLowerCase() === w.word.toLowerCase())) {
          next[w.word] = await promoteUsedWord(supabase, user.id, w);
        }
      }
      setPromoted(next);
      const list = [{ text: r.corrected || text, translation: r.translation, words: pair.map((w) => w.word), interest }, ...mine].slice(0, 100);
      setMine(list);
      AsyncStorage.setItem(`ls.mine.${lang}`, JSON.stringify(list)).catch(() => {});
    } else hapticWarning();
  };

  const next = () => {
    if (deck && Object.keys(promoted).length) setDeck({ ...deck, red: deck.red.filter((w) => !promoted[w.word]) });
    setRound((r) => r + 1);
  };

  if (!deck) {
    return <SafeAreaView style={s.screen}><ActivityIndicator color={COLOUR_HEX.green} style={{ marginTop: 80 }} /></SafeAreaView>;
  }

  const scoreColour = result ? COLOUR_HEX[result.score >= 30 ? 'green' : result.score >= 15 ? 'orange' : 'red'] : COLOUR_HEX.green;

  return (
    <SafeAreaView style={s.screen} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.row}>
            <Text style={s.big}>✍️</Text>
            <View style={{ flex: 1 }} />
            {interests.map((id) => (
              <Pressable key={id} onPress={() => pickInterest(id)} style={[s.square, id === interest && s.squareOn]}>
                <Text style={{ fontSize: 20 }}>{INTEREST_EMOJI[id] ?? '🌍'}</Text>
              </Pressable>
            ))}
          </View>

          {ABOUT_QUESTION[interest] ? (
            <View style={s.about}>
              <Text style={{ fontSize: 18 }}>{INTEREST_EMOJI[interest] ?? '🌍'}</Text>
              <TextInput
                value={about}
                onChangeText={setAbout}
                onEndEditing={() => { AsyncStorage.setItem(`ls.about.${interest}`, about.trim()).catch(() => {}); compose(); }}
                placeholder={ABOUT_QUESTION[interest]}
                placeholderTextColor={UI.textFaint}
                style={s.aboutInput}
                returnKeyType="done"
              />
            </View>
          ) : null}

          {deck.red.length === 0 ? (
            <Pressable style={s.card} onPress={() => router.push('/(tabs)/discover')}>
              <Text style={[s.big, { textAlign: 'center' }]}>🔴 0 → 📖🎬</Text>
            </Pressable>
          ) : (
            <View style={s.card}>
              <View style={{ minHeight: 28 }}>
                {composing ? <ActivityIndicator color={UI.textMuted} /> : <Text style={s.prompt}>{composed?.prompt || '…'}</Text>}
              </View>

              <View style={s.wrap}>
                {pair.map((w) => {
                  const used = usesWord(text, w.word);
                  const c = COLOUR_HEX[(promoted[w.word] as keyof typeof COLOUR_HEX) || 'red'];
                  return (
                    <View key={w.id} style={[s.chip, { borderColor: c, backgroundColor: used ? c : c + '22' }]}>
                      <Text style={[s.chipWord, { color: used ? '#08080B' : c }]}>{used ? '✓ ' : ''}{w.word}</Text>
                      {w.translation ? <Text style={[s.chipSub, { color: used ? '#08080B' : c }]}>{w.translation}</Text> : null}
                    </View>
                  );
                })}
              </View>

              <View style={s.wrap}>
                {greenHints.map((g) => (
                  <Pressable key={g} onPress={() => setText((t) => (t && !/\s$/.test(t) ? `${t} ${g}` : `${t}${g}`))} style={s.green}>
                    <Text style={{ color: COLOUR_HEX.green }}>{g}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                value={text}
                onChangeText={(t) => { setText(t); setResult(null); }}
                multiline
                placeholder="✍️"
                placeholderTextColor={UI.textFaint}
                style={s.input}
                autoCorrect={false}
              />

              {text.trim() ? (
                <Text style={s.live}>
                  {tokenize(text).map((p, i) => {
                    const c = p.word ? colourOf(deck, p.text) : null;
                    return <Text key={i} style={c ? { color: COLOUR_HEX[c], fontWeight: c === 'red' ? '800' : '500' } : undefined}>{p.text}</Text>;
                  })}
                </Text>
              ) : null}

              <View style={s.row}>
                <Pressable onPress={check} disabled={!text.trim() || checking} style={[s.btn, { backgroundColor: COLOUR_HEX.green, opacity: text.trim() ? 1 : 0.4 }]}>
                  {checking ? <ActivityIndicator color="#08080B" /> : <Text style={s.btnText}>✓</Text>}
                </Pressable>
                <Pressable onPress={() => setHint((h) => !h)} disabled={!composed} style={[s.btn, s.btnGhost]}>
                  <Text style={{ fontSize: 18 }}>💡</Text>
                </Pressable>
                <Pressable onPress={next} style={[s.btn, s.btnGhost]}>
                  <Text style={{ fontSize: 18, color: UI.text }}>↻</Text>
                </Pressable>
              </View>

              {hint && composed && !result ? (
                <View style={s.hint}>
                  <Text style={s.ls}>{composed.linguascript}</Text>
                  <Text style={s.sub}>{composed.translation}</Text>
                </View>
              ) : null}

              {result ? (
                <View style={[s.result, { borderColor: scoreColour }]}>
                  <Text style={[s.score, { color: scoreColour }]}>+{result.score}</Text>
                  <Text style={s.sub}>{result.feedback}</Text>
                  <Text style={s.ls}>{result.corrected}</Text>
                  {result.translation ? <Text style={s.sub}>{result.translation}</Text> : null}
                  <Pressable onPress={next} style={[s.btn, { backgroundColor: COLOUR_HEX.green, alignSelf: 'flex-start', marginTop: 8 }]}>
                    <Text style={s.btnText}>→</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          )}

          {mine.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={s.label}>LINGUASCRIPTS · {mine.length}</Text>
              {mine.slice(0, 12).map((m, i) => (
                <View key={i} style={s.mine}>
                  <Text style={{ fontSize: 16 }}>{INTEREST_EMOJI[m.interest] ?? '🌍'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: UI.text, fontSize: 15 }}>{m.text}</Text>
                    {m.translation ? <Text style={s.sub} numberOfLines={1}>{m.translation}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: UI.bg },
  content: { padding: 16, gap: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  big: { fontSize: 34, color: UI.text },
  square: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface, alignItems: 'center', justifyContent: 'center' },
  squareOn: { borderColor: COLOUR_HEX.green, backgroundColor: 'rgba(52,199,89,0.15)' },
  about: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  aboutInput: { flex: 1, color: UI.text, fontSize: 15, paddingVertical: 4 },
  card: { borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface, borderRadius: 24, padding: 16, gap: 14 },
  prompt: { color: UI.text, fontSize: 18, fontWeight: '700' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 2, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipWord: { fontSize: 16, fontWeight: '800' },
  chipSub: { fontSize: 12, opacity: 0.85 },
  green: { borderWidth: 1, borderColor: 'rgba(52,199,89,0.4)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  input: { minHeight: 96, borderWidth: 1, borderColor: UI.border, borderRadius: 16, padding: 12, color: UI.text, fontSize: 17, textAlignVertical: 'top', backgroundColor: UI.bg },
  live: { fontSize: 17, lineHeight: 26, color: UI.text },
  btn: { height: 48, minWidth: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnGhost: { borderWidth: 1, borderColor: UI.border },
  btnText: { color: '#08080B', fontSize: 20, fontWeight: '800' },
  hint: { borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(52,199,89,0.5)', borderRadius: 16, padding: 12, gap: 4 },
  result: { borderWidth: 2, borderRadius: 16, padding: 12, gap: 6 },
  score: { fontSize: 26, fontWeight: '900' },
  ls: { color: UI.text, fontSize: 17, fontWeight: '700' },
  sub: { color: UI.textMuted, fontSize: 13 },
  label: { color: UI.textMuted, fontSize: 12, fontWeight: '800', letterSpacing: 2 },
  mine: { flexDirection: 'row', gap: 10, borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface, borderRadius: 16, padding: 12 },
});
