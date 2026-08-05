import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState, useCallback } from 'react';
import WebView from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { tapLight, tapMedium, success } from '@/native/haptics';

const { height: SCREEN_H } = Dimensions.get('window');

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

function buildYouTubeHtml(videoId: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:#000;width:100%;height:100vh;overflow:hidden}
    #player{width:100%;height:100%}
    iframe{width:100%;height:100%;border:0}
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player;
    var tag=document.createElement('script');
    tag.src='https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    function onYouTubeIframeAPIReady(){
      player=new YT.Player('player',{
        videoId:'${videoId}',
        width:'100%',height:'100%',
        playerVars:{autoplay:1,controls:1,rel:0,playsinline:1,modestbranding:1,cc_load_policy:0},
        events:{
          onReady:function(){
            setInterval(function(){
              if(player&&player.getCurrentTime){
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type:'time',t:player.getCurrentTime(),d:player.getDuration()
                }));
              }
            },250);
          },
          onStateChange:function(e){
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'state',s:e.data}));
          }
        }
      });
    }
    document.addEventListener('message',function(e){
      try{var m=JSON.parse(e.data);if(!player)return;
        if(m.cmd==='play')player.playVideo();
        if(m.cmd==='pause')player.pauseVideo();
      }catch(ex){}
    });
  </script>
</body>
</html>`;
}

interface SubLine { start: number; end: number; text: string }
interface WordPopupData {
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context: string;
}

export default function WatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [film, setFilm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [primarySubs, setPrimarySubs] = useState<SubLine[]>([]);
  const [secondarySubs, setSecondarySubs] = useState<SubLine[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());

  const [popup, setPopup] = useState<WordPopupData | null>(null);
  const [popupLoading, setPopupLoading] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  const webviewRef = useRef<WebView>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const trackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load film
  useEffect(() => {
    if (!id) return;
    supabase
      .from('films')
      .select('id, title, url, description, cefr_level, language, thumbnail_url, duration_seconds')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setFilm(data);
        setLoading(false);
      });
  }, [id]);

  // Load saved words (for green highlight)
  useEffect(() => {
    if (!user || !film?.language) return;
    supabase
      .from('saved_words')
      .select('word')
      .eq('user_id', user.id)
      .eq('language', film.language)
      .then(({ data }) => {
        if (data) setSavedWords(new Set((data as any[]).map((r) => r.word.toLowerCase())));
      });
  }, [user, film?.language]);

  // Fetch subtitles from cache or edge function
  const fetchSubs = useCallback(async () => {
    if (!film?.id || !film?.language) return;
    setSubsLoading(true);

    const { data: cached } = await supabase
      .from('subtitles')
      .select('start_time, end_time, text, language, sort_order')
      .eq('film_id', film.id)
      .order('sort_order', { ascending: true });

    if (cached && (cached as any[]).length > 0) {
      const primary = (cached as any[]).filter((s) => s.language === film.language);
      const secondary = (cached as any[]).filter((s) => s.language !== film.language);
      if (primary.length > 0) {
        setPrimarySubs(primary.map((s) => ({ start: s.start_time, end: s.end_time, text: s.text })));
        setSecondarySubs(secondary.map((s) => ({ start: s.start_time, end: s.end_time, text: s.text })));
        setSubsLoading(false);
        return;
      }
    }

    // Fall back to fetch-captions edge function
    const ytId = film.url ? extractYouTubeId(film.url) : null;
    if (ytId) {
      const { data: fetched } = await supabase.functions.invoke('fetch-captions', {
        body: { videoId: ytId, language: film.language, nativeLanguage: 'en' },
      });
      if (fetched?.subtitles?.length) {
        setPrimarySubs((fetched.subtitles as any[]).map((s) => ({ start: s.start, end: s.end, text: s.text })));
      }
      if (fetched?.nativeSubtitles?.length) {
        setSecondarySubs((fetched.nativeSubtitles as any[]).map((s) => ({ start: s.start, end: s.end, text: s.text })));
      }
    }

    setSubsLoading(false);
  }, [film]);

  useEffect(() => {
    if (film) fetchSubs();
  }, [film, fetchSubs]);

  // Progress tracking every 10 s
  const trackProgress = useCallback(() => {
    if (!user || !film) return;
    const t = currentTimeRef.current;
    const dur = durationRef.current;
    if (t < 1 || dur < 1) return;
    const ytId = film.url ? extractYouTubeId(film.url) : film.id;
    supabase.from('watch_history').upsert({
      user_id: user.id,
      video_id: ytId ?? film.id,
      film_id: film.id,
      title: film.title,
      thumbnail_url: film.thumbnail_url,
      language: film.language,
      position_seconds: Math.floor(t),
      duration_seconds: Math.floor(dur),
      completion_pct: Math.round((t / dur) * 100),
      watched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,video_id' });
  }, [user, film]);

  useEffect(() => () => {
    if (trackTimerRef.current) clearInterval(trackTimerRef.current);
  }, []);

  const handleWebViewMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'time') {
        currentTimeRef.current = msg.t;
        durationRef.current = msg.d;
        setCurrentTime(msg.t);
      }
      if (msg.type === 'state') {
        if (msg.s === 1) {
          if (!trackTimerRef.current) {
            trackTimerRef.current = setInterval(trackProgress, 10000);
          }
        } else {
          if (trackTimerRef.current) {
            clearInterval(trackTimerRef.current);
            trackTimerRef.current = null;
            trackProgress();
          }
        }
      }
    } catch (_) {}
  }, [trackProgress]);

  // Word tap → translate → popup
  const handleWordTap = async (word: string, context: string) => {
    if (!film) return;
    tapLight();
    const clean = word.replace(/[.,!?;:"'«»()[\]…]/g, '').trim();
    if (!clean) return;
    setJustSaved(false);
    setPopup({ word: clean, translation: '...', pronunciation: '', ipa: '', context });
    setPopupLoading(true);

    const { data } = await supabase.functions.invoke('translate-word', {
      body: { word: clean, context, fromLanguage: film.language, toLanguage: 'en' },
    });
    setPopup({
      word: clean,
      translation: data?.translation ?? clean,
      pronunciation: data?.pronunciation ?? '',
      ipa: data?.ipa ?? '',
      context,
    });
    setPopupLoading(false);
  };

  const saveWord = async () => {
    if (!user || !film || !popup) return;
    tapMedium();
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('saved_words').upsert({
      user_id: user.id,
      word: popup.word,
      translation: popup.translation,
      pronunciation: popup.pronunciation,
      ipa: popup.ipa,
      context: popup.context,
      film_id: film.id,
      language: film.language,
      next_review: today,
      state: 'red',
      review_count: 0,
      times_correct: 0,
    }, { onConflict: 'user_id,word,language' });
    setSavedWords((prev) => new Set([...prev, popup.word.toLowerCase()]));
    success();
    setJustSaved(true);
    setTimeout(() => {
      setPopup(null);
      setJustSaved(false);
    }, 800);
  };

  const activePrimary = primarySubs.find((s) => currentTime >= s.start && currentTime < s.end);
  const activeSecondary = secondarySubs.find((s) => currentTime >= s.start && currentTime < s.end);

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color="#22c55e" />
      </SafeAreaView>
    );
  }

  const videoId = film?.url ? extractYouTubeId(film.url) : null;
  const videoHeight = Math.round(SCREEN_H * 0.38);

  return (
    <View style={styles.root}>
      {/* YouTube player */}
      <View style={{ height: videoHeight, backgroundColor: '#000' }}>
        {videoId ? (
          <WebView
            ref={webviewRef}
            source={{ html: buildYouTubeHtml(videoId) }}
            style={{ flex: 1 }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            onMessage={handleWebViewMessage}
          />
        ) : (
          <View style={styles.center}>
            <Text style={{ color: '#64748b' }}>No video available</Text>
          </View>
        )}
      </View>

      {/* Back button overlay */}
      <View style={styles.backBtn} pointerEvents="box-none">
        <Pressable onPress={() => { tapLight(); router.back(); }} style={styles.backPressable}>
          <Text style={{ color: '#22c55e', fontSize: 15 }}>← Back</Text>
        </Pressable>
      </View>

      {/* Film info */}
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
          {film?.title}
        </Text>
        {film?.cefr_level && (
          <Text style={{ color: '#64748b', fontSize: 13, marginTop: 2 }}>
            {film.cefr_level} · {film.language?.toUpperCase()}
          </Text>
        )}
      </View>

      {/* Subtitles */}
      <View style={styles.subsArea}>
        {subsLoading ? (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <ActivityIndicator color="#22c55e" size="small" />
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>Loading subtitles…</Text>
          </View>
        ) : (
          <>
            {activePrimary ? (
              <View style={styles.subsRow}>
                {activePrimary.text.split(' ').map((token, i) => {
                  const clean = token.replace(/[.,!?;:"'«»()[\]…]/g, '');
                  const saved = savedWords.has(clean.toLowerCase());
                  return (
                    <TouchableOpacity
                      key={i}
                      activeOpacity={0.6}
                      onPress={() => handleWordTap(token, activePrimary.text)}
                      style={{ marginRight: 4, marginBottom: 4 }}
                    >
                      <Text style={[styles.subWord, saved && styles.subWordSaved]}>{token}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              primarySubs.length > 0 && (
                <Text style={{ color: '#475569', fontSize: 13, fontStyle: 'italic', paddingHorizontal: 16 }}>
                  Tap a word when subtitles are showing to save it
                </Text>
              )
            )}

            {activeSecondary && (
              <Text style={{ color: '#64748b', fontSize: 14, fontStyle: 'italic', paddingHorizontal: 16, marginTop: 4 }}>
                {activeSecondary.text}
              </Text>
            )}

            {primarySubs.length === 0 && !subsLoading && (
              <Text style={{ color: '#475569', fontSize: 13, fontStyle: 'italic', paddingHorizontal: 16 }}>
                No subtitles found — play the video and words will appear here
              </Text>
            )}
          </>
        )}
      </View>

      {/* Description */}
      {film?.description && (
        <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} showsVerticalScrollIndicator={false}>
          <Text style={{ color: '#64748b', fontSize: 14, lineHeight: 22 }}>{film.description}</Text>
        </ScrollView>
      )}

      {/* Save word popup */}
      <Modal
        transparent
        visible={!!popup}
        animationType="slide"
        onRequestClose={() => setPopup(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPopup(null)}>
          <Pressable onPress={() => {}}>
            <View style={styles.popupSheet}>
              <View style={styles.popupHandle} />
              {popupLoading ? (
                <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                  <ActivityIndicator color="#22c55e" />
                  <Text style={{ color: '#64748b', marginTop: 8 }}>Translating…</Text>
                </View>
              ) : popup && (
                <>
                  <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{popup.word}</Text>
                  {popup.pronunciation ? (
                    <Text style={{ color: '#94a3b8', marginTop: 4 }}>{popup.pronunciation}</Text>
                  ) : null}
                  {popup.ipa ? (
                    <Text style={{ color: '#64748b', fontSize: 13 }}>{popup.ipa}</Text>
                  ) : null}
                  <Text style={{ color: '#22c55e', fontSize: 20, marginTop: 12 }}>{popup.translation}</Text>
                  {popup.context ? (
                    <Text style={{ color: '#475569', fontSize: 13, fontStyle: 'italic', marginTop: 8 }}>
                      "{popup.context}"
                    </Text>
                  ) : null}

                  {justSaved ? (
                    <View style={[styles.popupBtn, { backgroundColor: '#166534', marginTop: 24 }]}>
                      <Text style={{ color: '#22c55e', fontWeight: '600', fontSize: 16 }}>✓ Saved!</Text>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', marginTop: 24, gap: 12 }}>
                      <Pressable onPress={saveWord} style={[styles.popupBtn, { flex: 1, backgroundColor: '#22c55e' }]}>
                        <Text style={{ color: '#0b1215', fontWeight: '700', fontSize: 15 }}>Save to flashcards</Text>
                      </Pressable>
                      <Pressable onPress={() => setPopup(null)} style={[styles.popupBtn, { flex: 1, backgroundColor: '#1e2d35' }]}>
                        <Text style={{ color: '#94a3b8', fontWeight: '600', fontSize: 15 }}>I know this</Text>
                      </Pressable>
                    </View>
                  )}
                </>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b1215' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b1215' },
  backBtn: { position: 'absolute', top: 44, left: 0, right: 0, zIndex: 20 },
  backPressable: { paddingHorizontal: 16, paddingVertical: 8, alignSelf: 'flex-start' },
  subsArea: { minHeight: 80, paddingHorizontal: 16, paddingVertical: 8 },
  subsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  subWord: { color: '#fff', fontSize: 19, fontWeight: '500' },
  subWordSaved: { color: '#22c55e' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  popupSheet: {
    backgroundColor: '#131f26',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  popupHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#2d4a5a',
    alignSelf: 'center', marginBottom: 20,
  },
  popupBtn: {
    borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', justifyContent: 'center',
  },
});
