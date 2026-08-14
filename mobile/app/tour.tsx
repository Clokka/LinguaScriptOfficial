import { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tapLight } from '@/native/haptics';

const SLIDES = [
  {
    emoji: '🔥',
    title: 'Streaks & XP',
    body: 'Build a daily habit. Earn XP for every lesson and climb the leaderboard as you go.',
  },
  {
    emoji: '📝',
    title: 'AI Exercises',
    body: 'Smart fill-in-the-blank and grammar exercises generated from real video content.',
  },
  {
    emoji: '💾',
    title: 'Tap Any Word',
    body: 'Tap a subtitle word to save it instantly as a flashcard. Review later with spaced repetition.',
  },
  {
    emoji: '🎬',
    title: 'Dual Subtitles',
    body: 'Watch with both your target language and your native language subtitles at the same time. Immersion made easy.',
  },
  {
    emoji: '🦎',
    title: 'Real Videos',
    body: 'Learn from videos you actually enjoy — not boring textbooks. LinguaScript turns watching into studying.',
  },
];

export default function TourScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const handleNext = () => {
    tapLight();
    if (index < SLIDES.length - 1) {
      goTo(index + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleGetStarted = async () => {
    tapLight();
    await AsyncStorage.setItem('tour_seen', '1');
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.skipRow}>
        <Pressable onPress={handleGetStarted}>
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
          setIndex(newIndex);
        }}
        style={{ flex: 1 }}
      >
        {SLIDES.map((slide, i) => (
          <View key={i} style={[s.slide, { width }]}>
            <Text style={s.emoji}>{slide.emoji}</Text>
            <Text style={s.title}>{slide.title}</Text>
            <Text style={s.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <Pressable key={i} onPress={() => { tapLight(); goTo(i); }}>
              <View style={[s.dot, i === index && s.dotActive]} />
            </Pressable>
          ))}
        </View>

        <Pressable onPress={handleNext} style={s.nextBtn}>
          <Text style={s.nextBtnText}>
            {index === SLIDES.length - 1 ? 'Get started →' : 'Next →'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#0b1215' },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: 24, paddingTop: 8 },
  skip:    { color: '#475569', fontSize: 14 },

  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 40,
  },
  emoji: { fontSize: 96, marginBottom: 28 },
  title: { color: '#fff', fontSize: 30, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  body:  { color: '#64748b', fontSize: 16, textAlign: 'center', lineHeight: 24 },

  footer: { paddingHorizontal: 28, paddingBottom: 36, gap: 24 },
  dots:   { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: '#243239' },
  dotActive: { backgroundColor: '#22c55e', width: 22 },

  nextBtn:     { backgroundColor: '#22c55e', borderRadius: 16, paddingVertical: 17, alignItems: 'center' },
  nextBtnText: { color: '#0b1215', fontSize: 17, fontWeight: '800' },
});
