import { coverageBadge } from "@/lib/coverage";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Download, Maximize, Minimize, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import { GapFillChallenge } from "@/components/GapFillChallenge";
import { loadDeckIndex, normalizeToken, SavedWordLite, DeckState, coerceDeckState, maxState, bestStateForLemma } from "@/lib/vocab";
import { buildExerciseOptions } from "@/lib/linguascripts";
import { cacheWordImageByWord } from "@/lib/wordImages";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useUpgradeTrigger } from "@/hooks/useUpgradeTrigger";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTour } from "@/contexts/TourContext";
import { getLanguageLabel, getLanguageFlag, subtitlesLookLikeWrongLanguage } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { fetchCaptionsFromBrowser } from "@/lib/browserCaptionFetcher";
import { ChameleonLoader } from "@/components/ChameleonLoader";
import { PreTeachCard } from "@/components/PreTeachCard";
import { ContentLockScreen } from "@/components/ContentLockScreen";
import { ActiveLanguageBadge } from "@/components/ActiveLanguageBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { saveGuestWord } from "@/lib/guestWords";
import { playDing } from "@/lib/sound";
import { useXp } from "@/contexts/XpContext";
import { usePet } from "@/contexts/PetContext";
import { recordDailyVideoWatch, setReinforcementPending } from "@/lib/dailyVideo";
import { toast } from "sonner";
import { recordFeedEvent, feedSourceFor } from "@/lib/feedSignals";

// One signal per video per session, across re-renders.
const feedHalfSent = new Set<string>();
const feedDoneSent = new Set<string>();
const feedSaveSent = new Set<string>();
import {
  computeVideoComprehension,
  loadComprehensionRecord,
  zoneMessage,
  type VideoComprehension,
} from "@/lib/videoComprehension";
import { recordWatchSession, type RecordResult } from "@/lib/watchSessions";
import { WatchResultsModal } from "@/components/WatchResultsModal";
import { LearningBreakModal, type QuizWord } from "@/components/LearningBreakModal";
import { PronunciationJudge } from "@/components/PronunciationJudge";
import { DailyGoalTally } from "@/components/DailyGoalTally";
import { useDailyWordGoal } from "@/hooks/useDailyWordGoal";
import { WatchGoalGate } from "@/components/WatchGoalGate";
import { WatchWordCounter } from "@/components/WatchWordCounter";
import { VideoBlockedScreen, type VideoBlockKind } from "@/components/VideoBlockedScreen";
import { checkPetMilestones } from "@/lib/pets";
import { browserTranslateLines, translateWord } from "@/lib/browserTranslate";
import { emitDailyGoalReached } from "@/lib/rewards";

interface FilmData {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
  is_public: boolean;
  created_by: string | null;
}

interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

interface DisplaySubtitle {
  start: number;
  end: number;
  primary: string;
  secondary: string;
  words: { id: string; text: string; translation: string; pronunciation: string; ipa: string }[];
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/|live\/))([^&?\s]+)/);
  return match ? match[1] : null;
}

function textToWords(text: string, index: number) {
  return text.split(/\s+/).filter(Boolean).map((w, wi) => ({
    id: `${index}-${wi}`,
    text: w.replace(/[.,!?;:]/g, ""),
    translation: "",
    pronunciation: "",
    ipa: "",
  }));
}

function buildDisplaySubtitles(primary: SubtitleSegment[], secondary: SubtitleSegment[]): DisplaySubtitle[] {
  return primary.map((sub, i) => {
    const match = secondary.find((s) => Math.abs(s.start - sub.start) < 1.5);
    return {
      start: sub.start,
      end: sub.end,
      primary: sub.text,
      secondary: match?.text || "",
      words: textToWords(sub.text, i),
    };
  });
}

function subtitlesToSrt(subtitles: DisplaySubtitle[], textKey: "primary" | "secondary"): string {
  return subtitles
    .map((s, i) => {
      const text = textKey === "primary" ? s.primary : s.secondary;
      if (!text) return null;
      const fmt = (t: number) => {
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const sec = Math.floor(t % 60);
        const ms = Math.round((t % 1) * 1000);
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
      };
      return `${i + 1}\n${fmt(s.start)} --> ${fmt(s.end)}\n${text}\n`;
    })
    .filter(Boolean)
    .join("\n");
}

// ── Caption loader: 100% browser-side (DownSub architecture) ──
// No edge function touches YouTube. All requests come from user's browser IP.

async function loadStoredTrack(filmId: string, lang: string): Promise<SubtitleSegment[]> {
  const { data } = await supabase
    .from("subtitles")
    .select("start_time, end_time, text")
    .eq("film_id", filmId)
    .eq("language", lang)
    .order("sort_order", { ascending: true });
  return (data || []).map((r) => ({ start: r.start_time, end: r.end_time, text: r.text }));
}

async function persistTrack(filmId: string, lang: string, subs: SubtitleSegment[]) {
  if (!subs.length) return;
  await supabase.from("subtitles").delete().eq("film_id", filmId).eq("language", lang);
  for (let i = 0; i < subs.length; i += 100) {
    const batch = subs.slice(i, i + 100).map((s, idx) => ({
      film_id: filmId,
      start_time: s.start,
      end_time: s.end,
      text: s.text,
      sort_order: i + idx,
      language: lang,
    }));
    await supabase.from("subtitles").insert(batch);
  }
}

async function translateTrack(subs: SubtitleSegment[], from: string, to: string): Promise<SubtitleSegment[]> {
  if (!subs.length || from === to) return [];
  let lines: string[] = [];
  try {
    const { data, error } = await supabase.functions.invoke("translate-subtitles", {
      body: { subtitles: subs, fromLanguage: getLanguageLabel(from), toLanguage: getLanguageLabel(to) },
    });
    if (!error && data?.translations?.length) {
      lines = subs.map((_, i) => data.translations[i]?.translation || "");
    }
  } catch { /* fall through to the browser */ }
  // Server failed or came back empty: translate from the learner's browser.
  if (!lines.some((l) => l.trim())) {
    try {
      lines = await browserTranslateLines(subs.map((s) => s.text), from, to);
    } catch {
      return [];
    }
  }
  return subs
    .map((s, i) => ({ ...s, text: lines[i] || "" }))
    .filter((s) => s.text.trim().length > 0);
}

/**
 * Master caption loader — runs BEFORE overlay.
 * Priority: DB cache → Browser-side YouTube fetch (DownSub method) → AI translation fallback
 * YouTube is NEVER contacted from the server/edge function.
 */
async function loadAllCaptions(
  filmId: string,
  videoId: string,
  primaryLang: string,
  secondaryLang: string,
  onStatus: (msg: string) => void,
  /**
   * Languages to fall back to when the learning language has no caption track
   * on this video — e.g. a French learner opening an English video. We would
   * rather show the video's own language on top and translate underneath than
   * refuse to play it: there is still real reading practice in that.
   */
  fallbackLangs: string[] = [],
): Promise<{ primary: SubtitleSegment[]; secondary: SubtitleSegment[]; primaryLang: string }> {
  // 1) Check DB
  onStatus("Checking saved captions…");
  let primary = await loadStoredTrack(filmId, primaryLang);
  let secondary = primaryLang === secondaryLang ? primary : await loadStoredTrack(filmId, secondaryLang);

  // Detect cached duplicate (same text as primary) — purge so we can re-translate
  if (primaryLang !== secondaryLang && primary.length && secondary.length) {
    const sample = Math.min(5, primary.length, secondary.length);
    let same = 0;
    for (let i = 0; i < sample; i++) {
      if ((primary[i].text || "").trim() === (secondary[i].text || "").trim()) same++;
    }
    if (same === sample) {
      console.log("Cached secondary track is a duplicate — clearing");
      await supabase.from("subtitles").delete().eq("film_id", filmId).eq("language", secondaryLang);
      secondary = [];
    }
  }

  // Detect a cached secondary track that was saved under the right language
  // code but is actually written in a totally different one — a leftover
  // from providers that silently hand back the original track instead of
  // erroring when they can't translate. Purge so it gets re-fetched/re-translated.
  if (primaryLang !== secondaryLang && secondary.length && subtitlesLookLikeWrongLanguage(secondary, secondaryLang)) {
    console.warn(`Cached ${secondaryLang} track is actually a different language — purging`);
    await supabase.from("subtitles").delete().eq("film_id", filmId).eq("language", secondaryLang);
    secondary = [];
  }

  if (primary.length > 0 && (primaryLang === secondaryLang || secondary.length > 0)) {
    return { primary, secondary, primaryLang };
  }

  // The language the top line actually ends up in. Normally the learning
  // language; swapped by the fallback below when the video has no track in it.
  let effectivePrimary = primaryLang;

  // 2) Fetch via edge function (proxies InnerTube + tlang to avoid CORS)
  let edgeFailure: string | null = null;
  // Set when the server won't load a new (uncached) video for this learner:
  // "locked" = free plan, "limit" = today's new video already used.
  let blockReason: "locked" | "limit" | null = null;
  // Set when the video has no subtitle track in the learning language.
  let noSubtitles = false;
  if (!primary.length || (primaryLang !== secondaryLang && !secondary.length)) {
    onStatus(`Downloading ${getLanguageLabel(primaryLang)} & ${getLanguageLabel(secondaryLang)} captions…`);
    try {
      // 30s hard timeout so we never get stuck on a hung provider.
      const invokePromise = supabase.functions.invoke("fetch-captions", {
        body: { videoId, language: primaryLang, nativeLanguage: secondaryLang },
      });
      const timeoutPromise = new Promise<{ data: null; error: Error }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: new Error("Caption service timed out after 30s") }), 30000),
      );
      const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as any;
      if (error) {
        edgeFailure = error.message || "Caption service unavailable";
        console.warn("Edge caption fetch error:", error);
      } else if (data) {
        if (data.learningError) edgeFailure = data.learningError;
        if (data.locked) blockReason = "locked";
        else if (data.limitReached) blockReason = "limit";
        if (data.noSubtitles) noSubtitles = true;
        if (!primary.length && data.subtitles?.length) {
          primary = data.subtitles;
          await persistTrack(filmId, primaryLang, primary);
        }
        if (
          primaryLang !== secondaryLang &&
          !secondary.length &&
          data.nativeSubtitles?.length &&
          !subtitlesLookLikeWrongLanguage(data.nativeSubtitles, secondaryLang)
        ) {
          secondary = data.nativeSubtitles;
          await persistTrack(filmId, secondaryLang, secondary);
        }
      }
    } catch (e: any) {
      edgeFailure = e?.message || "Caption service failed";
      console.warn("Edge caption fetch failed:", e);
    }

    // Fallback A: browser-side InnerTube fetch (bypasses paid provider quotas).
    // Never for a video the server refused: new videos are a Pro feature.
    if (!blockReason && (!primary.length || (primaryLang !== secondaryLang && !secondary.length))) {
      onStatus("Provider unavailable — trying direct fetch…");
      try {
        const browserRes = await fetchCaptionsFromBrowser(videoId, primaryLang, secondaryLang);
        if (!primary.length && browserRes.learning.length) {
          primary = browserRes.learning;
          await persistTrack(filmId, primaryLang, primary);
        }
        if (
          primaryLang !== secondaryLang &&
          !secondary.length &&
          browserRes.native.length &&
          !subtitlesLookLikeWrongLanguage(browserRes.native, secondaryLang)
        ) {
          secondary = browserRes.native;
          await persistTrack(filmId, secondaryLang, secondary);
        }
      } catch (e) {
        console.warn("Browser caption fallback failed:", e);
      }
    }

    // Fallback C: no track in the learning language at all — take whatever the
    // video actually has (its own language, then the user's native language,
    // then English) and make that the top line.
    if (!primary.length) {
      const tried = new Set([primaryLang]);
      for (const alt of fallbackLangs) {
        const code = (alt || "").toLowerCase();
        if (!code || tried.has(code)) continue;
        tried.add(code);
        onStatus(`No ${getLanguageLabel(primaryLang)} captions — trying ${getLanguageLabel(code)}…`);

        let found: SubtitleSegment[] = await loadStoredTrack(filmId, code);
        if (!found.length) {
          try {
            const { data } = (await supabase.functions.invoke("fetch-captions", {
              body: { videoId, language: code, nativeLanguage: code },
            })) as any;
            if (data?.subtitles?.length) found = data.subtitles;
          } catch (e) {
            console.warn(`Fallback caption fetch (${code}) failed:`, e);
          }
        }
        if (!found.length) {
          try {
            const browserRes = await fetchCaptionsFromBrowser(videoId, code, code);
            if (browserRes.learning.length) found = browserRes.learning;
          } catch (e) {
            console.warn(`Fallback browser caption fetch (${code}) failed:`, e);
          }
        }

        if (found.length) {
          primary = found;
          effectivePrimary = code;
          edgeFailure = null;
          secondary = [];
          await persistTrack(filmId, code, primary);
          break;
        }
      }
    }

    // Fallback B: AI translate if one track still missing
    if (primary.length && !secondary.length && effectivePrimary !== secondaryLang) {
      onStatus(`Translating to ${getLanguageLabel(secondaryLang)}…`);
      secondary = await translateTrack(primary, effectivePrimary, secondaryLang);
      if (secondary.length) await persistTrack(filmId, secondaryLang, secondary);
    }

    if (!primary.length && (edgeFailure || blockReason || noSubtitles)) {
      // Surface via thrown error so caller can show it.
      throw Object.assign(new Error(edgeFailure || blockReason || "No subtitles"), { blockReason, noSubtitles });
    }
  }

  return {
    primary,
    secondary: effectivePrimary === secondaryLang ? primary : secondary,
    primaryLang: effectivePrimary,
  };
}

// ── YT Player globals ──

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const Watch = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro } = useSubscription();
  const { onWordSaved, onVideoFinished } = useUpgradeTrigger(isPro);
  const savedTodayRef = useRef(0);
  const dailyGoal = useDailyWordGoal();

  // Progress and the review button live in the word counter under the video.
  const registerDailySave = useCallback(() => {
    dailyGoal.bump();
  }, [dailyGoal]);
  const { learningLanguage, languageContext, isContentLocked } = useLanguage();
  const { award } = useXp();
  const { triggerReaction } = usePet();
  const videoWatchAwardedRef = useRef(false);
  const { registerPlayer, active: tourActive, step: tourStep } = useTour();
  const playerRef = useRef<any>(null);

  // The moment the last word of today's goal is added, pause and hand over to
  // the daily chest (DailyGoalChest). Only on the crossing, never on load.
  const goalReachedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (!user || dailyGoal.loading || dailyGoal.goal <= 0) return;
    const reached = dailyGoal.savedToday >= dailyGoal.goal;
    if (goalReachedRef.current === false && reached) {
      try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ }
      emitDailyGoalReached();
    }
    goalReachedRef.current = reached;
  }, [user, dailyGoal.loading, dailyGoal.savedToday, dailyGoal.goal]);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const historyIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const [film, setFilm] = useState<FilmData | null>(null);
  // Saving a word from a feed video is a strong "I like this" signal.
  const noteFeedSave = () => {
    if (!user || !film) return;
    const src = feedSourceFor(getYouTubeId(film.url));
    if (!src) return;
    const key = `${film.id}:${src.interest}`;
    if (feedSaveSent.has(key)) return;
    feedSaveSent.add(key);
    void recordFeedEvent(src.interest, src.lang, "save");
  };
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [showReinforce, setShowReinforce] = useState(false);
  // Per-video comprehension — drives both the pre-watch hint and the
  // post-watch completion screen with "Previous → Current" delta.
  const [comprehension, setComprehension] = useState<VideoComprehension | null>(null);
  const [priorScore, setPriorScore] = useState<number | null>(null);
  const [sessionResult, setSessionResult] = useState<RecordResult | null>(null);
  const [sessionDurationMin, setSessionDurationMin] = useState(0);
  const preWatchToastFiredRef = useRef(false);
  const [apiReady, setApiReady] = useState(!!window.YT?.Player);
  const [subtitles, setSubtitles] = useState<DisplaySubtitle[]>([]);
  const preTeachLines = useMemo(
    () => subtitles.map((s) => ({ primary: s.primary, secondary: s.secondary })),
    [subtitles],
  );
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsStatus, setCaptionsStatus] = useState<string | null>(null);
  const [captionsError, setCaptionsError] = useState<string | null>(null);
  // Set when a YouTube video can't be used because it has no captions in the
  // learning language — the page then shows a blocking screen, not the player.
  const [captionBlock, setCaptionBlock] = useState<VideoBlockKind | null>(null);
  const [showLearningBreak, setShowLearningBreak] = useState(false);
  const sessionSavedRef = useRef<QuizWord[]>([]);
  const breakTriggeredRef = useRef(false);

  // ── In-video gap challenge ────────────────────────────────────────────────
  // When a line is all green except ONE orange (learning) word that is due for
  // review, pause playback and ask the learner to drag the missing word back
  // in. Gated so it stays a treat: due words only, one line at most every
  // CHALLENGE_COOLDOWN_MS, and never the same line twice.
  const CHALLENGE_COOLDOWN_MS = 120000;
  const [challengeDeck, setChallengeDeck] = useState<Map<string, SavedWordLite>>(new Map());
  const [challenge, setChallenge] = useState<{
    words: string[]; gapIndex: number; answer: string; distractors: string[]; translation?: string;
  } | null>(null);
  const lastChallengeAtRef = useRef(0);
  const challengedLinesRef = useRef<Set<string>>(new Set());

  const maybeTriggerLearningBreak = useCallback((entry: QuizWord) => {
    if (!entry.word || !entry.translation) return;
    sessionSavedRef.current = [...sessionSavedRef.current, entry];
    if (!breakTriggeredRef.current && sessionSavedRef.current.length >= 5) {
      breakTriggeredRef.current = true;
      try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ }
      setShowLearningBreak(true);
    }
  }, []);
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isMobile = useIsMobile();
  const [isLandscape, setIsLandscape] = useState(false);
  const [landscapeBannerDismissed, setLandscapeBannerDismissed] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(orientation: landscape)");
    const h = () => setIsLandscape(mql.matches);
    h();
    mql.addEventListener?.("change", h);
    return () => mql.removeEventListener?.("change", h);
  }, []);
  // Skip the pre-roll house ad during the guided onboarding tour for a
  // frictionless first impression. The first thing the new user sees should
  // be the video + the teaching cursor, never an ad.
  const [adDone, setAdDone] = useState(tourActive);
  const finishPreTeach = useCallback(() => setAdDone(true), []);
  // Gold rings: pre-teach picks first, then unlearned words from the learner's
  // current Top-N frequency deck. The overlay caps rings per line.
  const [preTeachWords, setPreTeachWords] = useState<string[]>([]);
  const [focusWords, setFocusWords] = useState<string[]>([]);
  const handlePreTeachWords = useCallback((ws: string[]) => {
    setPreTeachWords(ws.map((w) => normalizeToken(w)));
  }, []);
  const targetWords = useMemo(() => new Set([...preTeachWords, ...focusWords]), [preTeachWords, focusWords]);
  const focusLang = film?.language || learningLanguage;
  useEffect(() => {
    if (!user?.id || !focusLang) return;
    let alive = true;
    import("@/lib/focusDeck").then(({ focusRingWords }) => focusRingWords(user.id, focusLang))
      .then((ws) => { if (alive) setFocusWords(ws); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.id, focusLang]);

  const [cssFullscreen, setCssFullscreen] = useState(false);
  const toggleFullscreen = useCallback(async () => {
    const container = videoContainerRef.current;
    if (!container) return;
    const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fsEl) {
      try {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
      } catch { /* noop */ }
      setCssFullscreen(false);
      return;
    }
    if (cssFullscreen) {
      setCssFullscreen(false);
      return;
    }
    // Try native fullscreen on container, then iframe, with iOS variants.
    // Await any returned promise so silent rejections (iOS Safari, sandboxed
    // iframes, permissions-policy blocks) reliably fall back to CSS fullscreen.
    const iframe = container.querySelector("iframe") as any;
    const tryReq = async (el: any): Promise<boolean> => {
      if (!el) return false;
      try {
        if (el.requestFullscreen) { await el.requestFullscreen(); return true; }
        if (el.webkitRequestFullscreen) { const r = el.webkitRequestFullscreen(); if (r?.then) await r; return true; }
        if (el.webkitEnterFullscreen) { el.webkitEnterFullscreen(); return true; }
      } catch { /* fall through to next candidate */ }
      return false;
    };
    if (await tryReq(container)) return;
    if (await tryReq(iframe)) return;
    // No native fullscreen available — use CSS-based fullscreen fallback.
    setCssFullscreen(true);
  }, [cssFullscreen]);

  // When the tour moves past the fullscreen step, drop CSS fullscreen so the
  // back button (and the rest of the page chrome) is visible again on mobile.
  useEffect(() => {
    if (!tourActive) return;
    if (tourStep && tourStep.id !== "watch-fullscreen" && cssFullscreen) {
      setCssFullscreen(false);
    }
  }, [tourActive, tourStep, cssFullscreen]);


  const watchStartRef = useRef<number | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Fullscreen detection (user may use browser/YT native fullscreen)

  useEffect(() => {
    const handler = () => {
      const fsEl = (document.fullscreenElement ||
        (document as any).webkitFullscreenElement) as Element | null;

      // YouTube's own fullscreen button promotes the IFRAME itself. The iframe
      // then paints over the whole screen and our subtitle layer — a sibling in
      // the DOM — disappears. Escalate to the player container instead, which
      // contains both the iframe and the overlay, so the native button behaves
      // exactly like ours.
      const container = videoContainerRef.current;
      if (fsEl && container && fsEl !== container && container.contains(fsEl)) {
        void (async () => {
          try {
            if (document.exitFullscreen) await document.exitFullscreen();
            else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
            await (container as any).requestFullscreen?.();
          } catch {
            // Native escalation refused (iOS) — fall back to CSS fullscreen so
            // the subtitles are still on top.
            setCssFullscreen(true);
          }
        })();
        setIsFullscreen(true);
        return;
      }

      setIsFullscreen(!!fsEl);
    };
    document.addEventListener("fullscreenchange", handler);
    document.addEventListener("webkitfullscreenchange", handler);
    return () => {
      document.removeEventListener("fullscreenchange", handler);
      document.removeEventListener("webkitfullscreenchange", handler);
    };
  }, []);


  // Load film
  useEffect(() => {
    if (!id) return;
    supabase.from("films").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setFilm(data);
      setLoading(false);
    });
  }, [id]);

  // Load native language from profile
  useEffect(() => {
    if (!user) { setNativeLanguage("en"); return; }
    supabase
      .from("profiles")
      .select("native_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.native_language) setNativeLanguage(data.native_language);
      });
  }, [user]);

  // ── CAPTION LOADING — runs before overlay ──
  // Two strict cases:
  //   A) Admin/library film (is_public=true): use ONLY stored SRTs. Never fetch from
  //      YouTube, never auto-translate. The user's profile language does NOT influence
  //      what is shown — primary = film.language, secondary = any other stored track.
  //   B) User-pasted YouTube link (is_public=false): auto-fetch from YouTube, and
  //      auto-translate if the second-language track is missing.
  useEffect(() => {
    if (!film) return;
    let cancelled = false;

    const run = async () => {
      setCaptionsLoading(true);
      setCaptionsError(null);
      setCaptionBlock(null);
      setCaptionsStatus(null);

      // ── Case A: Admin/library film — stored SRTs only ──
      if (film.is_public) {
        setCaptionsStatus("Loading subtitles…");
        const primaryLang = film.language || "fr";

        // Discover what languages are stored for this film
        const { data: langRows } = await supabase
          .from("subtitles")
          .select("language")
          .eq("film_id", film.id);
        const storedLangs = Array.from(new Set((langRows || []).map((r: any) => r.language)));

        const primary = await loadStoredTrack(film.id, primaryLang);
        const secondaryLang = storedLangs.find((l) => l !== primaryLang) || primaryLang;
        const secondary = secondaryLang === primaryLang ? primary : await loadStoredTrack(film.id, secondaryLang);

        if (cancelled) return;

        if (primary.length > 0) {
          setSubtitles(buildDisplaySubtitles(primary, secondary));
          setCaptionsStatus(null);
        } else {
          setCaptionsError(
            `No ${getLanguageLabel(primaryLang)} subtitles uploaded for this film yet.`
          );
        }
        setCaptionsLoading(false);
        return;
      }

      // ── Case B: User-pasted YouTube link — auto-fetch + auto-translate ──
      const primaryLang = learningLanguage || film.language || "fr";
      const secondaryLang = nativeLanguage || "en";
      const ytId = getYouTubeId(film.url);

      if (!ytId) {
        if (!cancelled) {
          setCaptionsLoading(false);
          setCaptionsError("Invalid video URL — cannot load captions");
        }
        return;
      }

      let primary: SubtitleSegment[] = [];
      let secondary: SubtitleSegment[] = [];
      let loadError: string | null = null;
      let blockReason: "locked" | "limit" | null = null;
      let noSubtitles = false;
      let usedLang = primaryLang;
      try {
        const res = await loadAllCaptions(
          film.id, ytId, primaryLang, secondaryLang,
          (msg) => { if (!cancelled) setCaptionsStatus(msg); },
          // No fallback languages: a video without learning-language captions
          // can't be used, so it's blocked below instead of shown in English.
          [],
        );
        primary = res.primary;
        secondary = res.secondary;
        usedLang = res.primaryLang;
      } catch (e: any) {
        loadError = e?.message || "Caption fetch failed";
        blockReason = e?.blockReason ?? null;
        noSubtitles = !!e?.noSubtitles;
      }

      if (cancelled) return;

      if (primary.length > 0) {
        setSubtitles(buildDisplaySubtitles(primary, secondary));
        setCaptionsStatus(null);
        if (usedLang !== primaryLang) {
          toast.message(`No ${getLanguageLabel(primaryLang)} captions on this video`, {
            description: `Showing ${getLanguageLabel(usedLang)} with a ${getLanguageLabel(secondaryLang)} translation underneath.`,
            duration: 7000,
          });
        }
      } else {
        // "No … captions on YouTube" means the video truly lacks a track;
        // anything else (timeout, provider limit) is a temporary failure.
        const missing = noSubtitles || !loadError || /no \S+ captions/i.test(loadError);
        setCaptionBlock(blockReason ?? (missing ? "missing" : "error"));
        setCaptionsStatus(null);
      }
      setCaptionsLoading(false);
    };

    void run();
    return () => { cancelled = true; };
  }, [film, learningLanguage, nativeLanguage]);

  // Compute per-video comprehension once subtitles are loaded.
  // We re-run when learning language changes (different deck applies).
  useEffect(() => {
    if (!film || subtitles.length === 0) return;
    const lang = (film.is_public ? (film.language || learningLanguage) : learningLanguage) || "fr";
    let cancelled = false;
    (async () => {
      const comp = await computeVideoComprehension(user?.id ?? null, film.id, lang);
      if (cancelled) return;
      setComprehension(comp);
      if (user) {
        const prior = await loadComprehensionRecord(user.id, film.id, "film");
        if (cancelled) return;
        setPriorScore(prior ? Number(prior.first_score) : null);
      }
      // One-shot pre-watch hint.
      if (!preWatchToastFiredRef.current) {
        preWatchToastFiredRef.current = true;
        toast.message(coverageBadge(comp.pct), {
          description: zoneMessage(comp.pct),
          duration: 4000,
          position: "top-center",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [film, subtitles, learningLanguage, user]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT?.Player) { setApiReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  // Create player — only after the pre-roll ad finishes (or is skipped)
  useEffect(() => {
    if (!apiReady || !film || !adDone) return;
    const ytId = getYouTubeId(film.url);
    if (!ytId) return;

    playerRef.current = new window.YT.Player("yt-player", {
      videoId: ytId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: tourActive ? 1 : 0, controls: 1, modestbranding: 1, rel: 0, cc_load_policy: 0 },
      events: {
        onReady: () => {
          registerPlayer(playerRef.current);
          if (tourActive) {
            try { playerRef.current?.playVideo?.(); } catch { /* noop */ }
          }
        },
        onStateChange: (event: any) => {
          if (event.data === window.YT.PlayerState.PLAYING) {
            watchStartRef.current = Date.now();
            intervalRef.current = setInterval(() => {
              if (playerRef.current?.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime());
              }
            }, 250);
          } else {
            clearInterval(intervalRef.current);
            if (watchStartRef.current && user) {
              const mins = Math.round((Date.now() - watchStartRef.current) / 60000);
              if (mins > 0) logWatchTime(mins);
              watchStartRef.current = null;
            }
            // Feed taste signals: watched past halfway / finished.
            const src = user && film ? feedSourceFor(getYouTubeId(film.url)) : null;
            if (src) {
              try {
                const p = playerRef.current;
                const dur = p?.getDuration?.() || 0;
                const pos = p?.getCurrentTime?.() || 0;
                const key = `${film!.id}:${src.interest}`;
                if (dur > 0 && pos / dur >= 0.5 && !feedHalfSent.has(key)) {
                  feedHalfSent.add(key);
                  void recordFeedEvent(src.interest, src.lang, "half");
                }
                if (event.data === window.YT.PlayerState.ENDED && !feedDoneSent.has(key)) {
                  feedDoneSent.add(key);
                  void recordFeedEvent(src.interest, src.lang, "complete");
                  toast("Up next: more like this", {
                    duration: 8000,
                    action: { label: "Watch next", onClick: () => navigate("/discover") },
                  });
                }
              } catch { /* noop */ }
            }
            if (event.data === window.YT.PlayerState.ENDED && !videoWatchAwardedRef.current) {
              videoWatchAwardedRef.current = true;
              award("video_watch", { videoId: film?.id });
              if (user && film) void recordDailyVideoWatch(user.id, film.id);
              // Recompute + persist comprehension so the completion screen
              // reflects any words promoted during this very watch.
              (async () => {
                if (!film) { setShowReinforce(true); return; }
                const lang = (film.is_public ? (film.language || learningLanguage) : learningLanguage) || "fr";
                const comp = await computeVideoComprehension(user?.id ?? null, film.id, lang);
                setComprehension(comp);
                let durSec = 0;
                let pctDone = 100;
                try {
                  const p = playerRef.current;
                  durSec = Math.floor(p?.getDuration?.() || 0);
                  const pos = Math.floor(p?.getCurrentTime?.() || durSec);
                  if (durSec > 0) pctDone = Math.min(100, Math.round((pos / durSec) * 100));
                } catch { /* noop */ }
                setSessionDurationMin(durSec > 0 ? durSec / 60 : 0);
                if (user) {
                  const r = await recordWatchSession(film.id, lang, comp, durSec, pctDone);
                  setSessionResult(r);
                  if (r && r.prev_pct !== null && r.delta >= 5) {
                    toast.success(`You now understand ${Math.round(r.delta)}% more of this video! 🎉`);
                  }
                } else {
                  setSessionResult({ watch_number: 1, prev_pct: null, new_pct: comp.pct, delta: 0, first_pct: comp.pct, best_pct: comp.pct });
                  onVideoFinished(true);
                }
                setShowReinforce(true);
              })();
            }
          }
        },
      },
    });

    return () => { clearInterval(intervalRef.current); };
  }, [apiReady, film, adDone]);

  // Watch-history: persist position every ~10s while playing.
  useEffect(() => {
    if (!user || !film) return;
    const ytId = getYouTubeId(film.url);
    if (!ytId) return;
    const writeProgress = async (final = false) => {
      try {
        const p = playerRef.current;
        if (!p?.getCurrentTime) return;
        const pos = Math.floor(p.getCurrentTime() || 0);
        const dur = Math.floor(p.getDuration?.() || 0);
        if (pos <= 0 || dur <= 0) return;
        const pct = Math.min(100, Math.round((pos / dur) * 10000) / 100);
        await supabase.from("watch_history").upsert({
          user_id: user.id,
          video_id: ytId,
          film_id: film.id,
          title: film.title,
          thumbnail_url: film.thumbnail_url,
          language: film.language,
          position_seconds: pos,
          duration_seconds: dur,
          completion_pct: pct,
          watched_at: new Date().toISOString(),
        }, { onConflict: "user_id,video_id" });
      } catch (e) { /* non-fatal */ }
    };
    historyIntervalRef.current = setInterval(() => writeProgress(false), 10000);
    const onUnload = () => writeProgress(true);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      clearInterval(historyIntervalRef.current);
      window.removeEventListener("beforeunload", onUnload);
      void writeProgress(true);
    };
  }, [user, film, apiReady, adDone]);

  const logWatchTime = async (minutes: number) => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];
    const { data: existing } = await supabase
      .from("activity_log")
      .select("id, minutes_watched")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (existing) {
      await supabase.from("activity_log")
        .update({ minutes_watched: (existing.minutes_watched || 0) + minutes })
        .eq("id", existing.id);
    } else {
      await supabase.from("activity_log").insert({
        user_id: user.id, date: today, minutes_watched: minutes, videos_watched: 1,
      });
    }
  };

  const saveWordToFlashcards = async (word: { id: string; text: string; translation: string; pronunciation: string; ipa: string }) => {
    let { translation, pronunciation, ipa } = word;
    const context = currentSubtitle?.primary || "";
    const langCode = film?.language || learningLanguage || "fr";
    const fromLang = getLanguageLabel(langCode);
    const toLang = getLanguageLabel(nativeLanguage);

    // Lemma info: a clicked word is often an inflected surface form (French
    // "manges" from "manger", German a declined "wissen") — without this, a
    // learner memorizes "manges = eat" instead of "manger = to eat".
    let lemma: string | null = null;
    let lemmaTranslation: string | null = null;
    let pos: string | null = null;
    let isInflected = false;
    let grammarNote: string | null = null;

    // A popup placeholder is not a meaning — never save it onto a card.
    if (/^(Translating|Couldn't translate)/.test(translation || "")) translation = "";

    // If translation is empty, fetch it (server first, browser fallback)
    if (!translation) {
      try {
        const t = await translateWord(
          (body) => supabase.functions.invoke("translate-word", { body }),
          word.text, context, langCode, nativeLanguage || "en",
          { from: fromLang, to: toLang },
        );
        translation = t.translation;
        pronunciation = t.pronunciation;
        ipa = t.ipa;
        lemma = t.lemma;
        lemmaTranslation = t.lemmaTranslation;
        pos = t.pos;
        isInflected = t.isInflected;
        grammarNote = t.grammarNote;
      } catch (e) {
        console.error("Word translation failed:", e);
      }
    }

    // Guest mode: store in localStorage so onboarding works without sign-in.
    if (!user) {
      saveGuestWord({
        word: word.text,
        translation,
        pronunciation,
        ipa,
        context,
        language: langCode,
      });
      award("add_word");
      triggerReaction("happy", 2000);
      savedTodayRef.current += 1;
      onWordSaved(savedTodayRef.current);
      registerDailySave();
      playDing("success");
      maybeTriggerLearningBreak({ word: word.text, translation });
      return;
    }

    if (!film) return;

    // Don't restart a lemma's progress at red: (1) re-saving a word the
    // learner already knows shouldn't reset its state or SRS progress, and
    // (2) a freshly-clicked conjugation of an already-mastered verb
    // ("mangeons" when "manger" is green via "manges") should start out
    // green, not as if it were a new, unrelated word.
    let initialState: DeckState = "red";
    let initialReviewCount = 0;
    let initialTimesCorrect = 0;
    let initialNextReview = new Date().toISOString().split("T")[0];
    const { data: existingSame } = await supabase
      .from("saved_words")
      .select("state, review_count, times_correct, next_review")
      .eq("user_id", user.id)
      .eq("language", langCode)
      .eq("word", word.text)
      .maybeSingle();
    if (existingSame) {
      initialState = coerceDeckState(existingSame.state);
      initialReviewCount = existingSame.review_count ?? 0;
      initialTimesCorrect = existingSame.times_correct ?? 0;
      initialNextReview = existingSame.next_review ?? initialNextReview;
    }
    if (lemma) {
      const lemmaBest = await bestStateForLemma(user.id, langCode, lemma);
      if (lemmaBest) initialState = maxState(initialState, lemmaBest);
    }

    const { error: saveError } = await supabase.from("saved_words").upsert({
      user_id: user.id,
      word: word.text,
      translation,
      pronunciation,
      ipa,
      context,
      film_id: film.id,
      language: langCode,
      next_review: initialNextReview,
      state: initialState,
      review_count: initialReviewCount,
      times_correct: initialTimesCorrect,
      lemma,
      lemma_translation: lemmaTranslation,
      pos,
      is_inflected: isInflected,
      grammar_note: grammarNote,
    }, { onConflict: "user_id,word,language" });
    if (saveError) {
      console.error("Save word failed", saveError);
      toast.error("Couldn't save this flashcard", { description: saveError.message });
      return;
    }
    award("add_word");
    triggerReaction("happy", 2000);
    savedTodayRef.current += 1;
    onWordSaved(savedTodayRef.current);
    registerDailySave();
    playDing("success");
    maybeTriggerLearningBreak({ word: word.text, translation });

    // Create LinguaScript record immediately (scheduled for now, not tomorrow).
    // Must include gap_options/mcq_options — LinguaScriptExercise crashes
    // reading exercise.gap_options.correct when a row lacks them.
    {
      const sentence = context || word.text;
      const { gapPosition, gapOptions, mcqOptions } = buildExerciseOptions(sentence, word.text, []);
      supabase.from("linguascripts").insert({
        user_id: user.id,
        language: langCode,
        target_word: word.text,
        sentence,
        translation: translation,
        word_state: "red",
        gap_position: gapPosition,
        gap_options: gapOptions,
        mcq_options: mcqOptions,
        status: "pending",
        attempts: 0,
        combo_multiplier: 1,
        scheduled_for: new Date().toISOString(),
      } as any).then(({ error }) => { if (error) console.error("Failed to create LinguaScript:", error); });
    }

    // Fire-and-forget: cache an Openverse image for text-to-image flashcards.
    // The translation is usually the more Openverse-searchable term.
    void cacheWordImageByWord(user.id, word.text, langCode, translation || word.text);
  };

  const savePhrase = async (phrase: string) => {
    const trimmed = phrase.trim();
    if (!trimmed) return;
    const context = currentSubtitle?.primary || trimmed;
    const langCode = film?.language || learningLanguage || "fr";
    const fromLang = getLanguageLabel(langCode);
    const toLang = getLanguageLabel(nativeLanguage);

    let translation = "";
    try {
      const t = await translateWord(
        (body) => supabase.functions.invoke("translate-word", { body }),
        trimmed, context, langCode, nativeLanguage || "en",
        { from: fromLang, to: toLang },
      );
      translation = t.contextTranslation || t.translation;
    } catch (e) {
      console.error("Phrase translation failed:", e);
    }

    if (!user) {
      saveGuestWord({
        word: trimmed,
        translation,
        pronunciation: "",
        ipa: "",
        context,
        language: langCode,
      });
      toast.success("Phrase saved");
      playDing("success");
      return;
    }

    if (!film) return;
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase.from("saved_words").upsert({
      user_id: user.id,
      word: trimmed,
      translation,
      pronunciation: "",
      ipa: "",
      context,
      film_id: film.id,
      language: langCode,
      is_phrase: true,
      next_review: today,
      state: "red",
      review_count: 0,
      times_correct: 0,
    } as any, { onConflict: "user_id,word,language" });
    if (error) {
      console.error("Save phrase failed", error);
      toast.error("Couldn't save phrase");
      return;
    }
    toast.success("Phrase saved to flashcards");
    registerDailySave();
    playDing("success");

    // Create LinguaScript record for phrase (scheduled for now, not tomorrow)
    {
      const phraseSentence = context || trimmed;
      const { gapPosition, gapOptions, mcqOptions } = buildExerciseOptions(phraseSentence, trimmed, []);
      supabase.from("linguascripts").insert({
        user_id: user.id,
        language: langCode,
        target_word: trimmed,
        sentence: phraseSentence,
        translation: translation,
        word_state: "red",
        gap_position: gapPosition,
        gap_options: gapOptions,
        mcq_options: mcqOptions,
        status: "pending",
        attempts: 0,
        combo_multiplier: 1,
        scheduled_for: new Date().toISOString(),
      } as any).then(({ error }) => { if (error) console.error("Failed to create LinguaScript for phrase:", error); });
    }

    void cacheWordImageByWord(user.id, trimmed, langCode, translation || trimmed);
  };

  const markWordKnown = async (word: { text: string; translation?: string }) => {
    const langCode = film?.language || learningLanguage || "fr";
    if (!user) {
      saveGuestWord({
        word: word.text,
        translation: word.translation || "",
        pronunciation: "",
        ipa: "",
        context: currentSubtitle?.primary || "",
        language: langCode,
      });
      toast.success("Marked as known: " + word.text);
      return;
    }
    const { error: knownError } = await supabase.from("saved_words").upsert({
      user_id: user.id,
      word: word.text,
      translation: word.translation || "",
      context: currentSubtitle?.primary || "",
      film_id: film?.id,
      language: langCode,
      state: "green",
      state_changed_at: new Date().toISOString(),
    }, { onConflict: "user_id,word,language" });
    if (knownError) {
      console.error("Mark known failed", knownError);
      toast.error("Couldn't update this flashcard", { description: knownError.message });
      return;
    }
    toast.success("Marked as known: " + word.text);

    // Create LinguaScript record for known word (scheduled for now, not 7 days from now)
    {
      const knownSentence = currentSubtitle?.primary || word.text;
      const { gapPosition, gapOptions, mcqOptions } = buildExerciseOptions(knownSentence, word.text, []);
      supabase.from("linguascripts").insert({
        user_id: user.id,
        language: langCode,
        target_word: word.text,
        sentence: knownSentence,
        translation: word.translation || "",
        word_state: "green",
        gap_position: gapPosition,
        gap_options: gapOptions,
        mcq_options: mcqOptions,
        status: "pending",
        attempts: 0,
        combo_multiplier: 1,
        scheduled_for: new Date().toISOString(),
      } as any).then(({ error }) => { if (error) console.error("Failed to create LinguaScript for known word:", error); });
    }

    void cacheWordImageByWord(user.id, word.text, langCode, word.translation || word.text);
  };

  const downloadSrt = (type: "primary" | "secondary") => {
    const content = subtitlesToSrt(subtitles, type);
    if (!content) return;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const lang = type === "primary" ? (film?.language || learningLanguage || "original") : nativeLanguage;
    a.download = `${film?.title || "subtitles"}_${lang}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const currentSubtitle = subtitles.find((s) => currentTime >= s.start && currentTime < s.end);

  // Load the deck used to evaluate challenge-worthy lines (same language the
  // words are saved under, matching the subtitle colouring).
  const challengeLang = film?.language || learningLanguage || "fr";
  useEffect(() => {
    let alive = true;
    loadDeckIndex(user?.id ?? null, challengeLang).then((m) => { if (alive) setChallengeDeck(m); });
    return () => { alive = false; };
  }, [user, challengeLang]);

  // Detect a qualifying line and fire the challenge.
  useEffect(() => {
    if (challenge || !currentSubtitle?.primary || challengeDeck.size === 0) return;
    if (Date.now() - lastChallengeAtRef.current < CHALLENGE_COOLDOWN_MS) return;

    const line = currentSubtitle.primary;
    if (challengedLinesRef.current.has(line)) return;

    const raw = line.split(/\s+/).filter(Boolean);
    if (raw.length < 3 || raw.length > 14) return;

    // Exactly one learning/orange word, everything else green.
    // Allow ORANGE or RED words that are due for review (SRS system)
    let gapIndex = -1;
    for (let i = 0; i < raw.length; i++) {
      const st = challengeDeck.get(normalizeToken(raw[i]))?.state;
      if (st === "orange" || st === "red") {  // Updated: allow both orange AND red for SRS
        if (gapIndex !== -1) return;   // more than one learning word → not a clean gap
        gapIndex = i;
      } else if (st !== "green") {
        return;                         // an unsaved word → line isn't ready
      }
    }
    if (gapIndex === -1) return;

    // Gate on "due for review" so this stays occasional.
    // Both next_review (old system) and SRS scheduling are checked
    const entry = challengeDeck.get(normalizeToken(raw[gapIndex]));
    const due = entry?.next_review;
    if (!due || new Date(due) > new Date()) return;  // Check old system timing

    // Plausible distractors: other learning/known words from the same deck.
    const answerKey = normalizeToken(raw[gapIndex]);
    const pool = Array.from(challengeDeck.values())
      .filter((w) => normalizeToken(w.word) !== answerKey && w.word.length > 2)
      .map((w) => w.word);
    const distractors: string[] = [];
    while (distractors.length < 3 && pool.length) {
      const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
      if (!distractors.includes(pick)) distractors.push(pick);
    }
    if (distractors.length < 2) return;

    challengedLinesRef.current.add(line);
    lastChallengeAtRef.current = Date.now();
    try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ }
    setChallenge({
      words: raw,
      gapIndex,
      answer: raw[gapIndex],
      distractors,
      translation: currentSubtitle.secondary,
    });
  }, [currentSubtitle, challengeDeck, challenge]);

  const resumeFromChallenge = useCallback(() => {
    setChallenge(null);
    try { playerRef.current?.playVideo?.(); } catch { /* noop */ }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!film) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Film not found</p>
          <Button variant="ghost" onClick={() => navigate("/discover")}>Go Home</Button>
        </div>
      </div>
    );
  }

  // ── CONTENT LANGUAGE LOCK ──
  // Free users can only open films matching their active learning language.
  // Their own pasted lessons (is_public=false) are always allowed; only
  // catalog/library films enforce the lock.
  if (film.is_public && isContentLocked(film.language)) {
    return (
      <ContentLockScreen
        contentLanguage={film.language}
        activeLanguage={languageContext}
        thumbnailUrl={film.thumbnail_url}
        title={film.title}
        onBack={() => navigate("/discover")}
        onUpgrade={() => navigate("/pricing")}
      />
    );
  }

  if (captionBlock) {
    return <VideoBlockedScreen kind={captionBlock} />;
  }

  // ── MOBILE LAYOUT (<768px, or a phone turned sideways) — desktop layout below is untouched ──
  const isPhoneLandscape =
    isLandscape && typeof window !== "undefined" &&
    window.matchMedia("(pointer: coarse)").matches && window.innerHeight < 540;
  if ((isMobile || isPhoneLandscape) && !isFullscreen) {
    const header = (
      <div className="flex items-center gap-2 p-2 bg-black/80 backdrop-blur z-20">
        {user && <WatchGoalGate goal={dailyGoal.goal} playerRef={playerRef} savedToday={dailyGoal.savedToday} />}
        <Button data-tour="page-back" variant="ghost" size="icon" onClick={() => navigate("/discover")} className="text-white hover:bg-white/10 shrink-0 h-9 w-9">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate text-sm">{film.title}</h1>
          <p className="text-white/60 text-[11px] truncate">
            {getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}
          </p>
        </div>
        <ActiveLanguageBadge variant="dark" className="hidden xs:inline-flex" />
        <Button
          data-tour="dual-toggle"
          variant={subtitleMode === "dual" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
          className={cn("h-8 px-2 text-[11px] shrink-0", subtitleMode !== "dual" && "text-white hover:bg-white/10")}
        >
          {subtitleMode === "dual" ? "Dual: ON" : "Dual: OFF"}
        </Button>
        <Button data-tour="fullscreen-btn" variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10 shrink-0 h-9 w-9">
          {cssFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
        </Button>
      </div>
    );

    const videoBlock = (
      <div
        ref={videoContainerRef}
        className={cn(
          "relative bg-black overflow-hidden mx-auto",
          cssFullscreen && "fixed inset-0 z-[10000] mx-0"
        )}
        style={
          cssFullscreen
            ? { width: "100vw", height: "100vh" }
            : { aspectRatio: "16 / 9", width: "100%", maxWidth: "100vw", maxHeight: "100%" }
        }
      >
        <div id="yt-player" className="absolute inset-0 w-full h-full" />
        {!adDone && (subtitles.length ? (
            <PreTeachCard
              lines={preTeachLines}
              language={film.language || learningLanguage || "fr"}
              level={(languageContext as any)?.cefrLevel ?? (film as any).cefr_level ?? null}
              goal={dailyGoal.goal}
              userId={user?.id}
              onComplete={finishPreTeach}
              onWords={handlePreTeachWords}
            />
          ) : <ChameleonLoader onComplete={finishPreTeach} duration={captionsLoading ? 12000 : 5000} />)}
        {cssFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-[10001] text-white bg-black/50 hover:bg-black/70 h-10 w-10 rounded-full"
          >
            <Minimize className="w-5 h-5" />
          </Button>
        )}
        {captionsLoading && captionsStatus && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white/80 text-xs px-3 py-1.5 rounded-lg flex items-center gap-2 z-[9999] max-w-[90%]">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span className="truncate">{captionsStatus}</span>
          </div>
        )}
        {captionsError && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-destructive/80 text-destructive-foreground text-xs px-3 py-1.5 rounded-lg z-[9999] max-w-[90%]">
            {captionsError}
          </div>
        )}
      </div>
    );

    const subtitleBlock = currentSubtitle && (
      <div
        className="w-full px-3 py-2 bg-black/90 overflow-hidden"
        style={{
          maxHeight: "25vh",
          fontSize: isLandscape ? "clamp(12px, 2vw, 16px)" : undefined,
        }}
      >
        <SubtitleOverlay
          primaryText={currentSubtitle.primary}
          secondaryText={currentSubtitle.secondary}
          words={currentSubtitle.words}
          targetWords={targetWords}
          mode={subtitleMode}
          onSaveWord={saveWordToFlashcards}
          onSavePhrase={savePhrase}
          onMarkKnown={markWordKnown}
          nativeLanguage={nativeLanguage}
          contentLanguage={learningLanguage || film.language || "fr"}
          className={isLandscape ? "!px-3 !py-2 [&_.subtitle-text]:!text-base" : "!px-4 !py-3 [&_.subtitle-text]:!text-lg"}
        />
        <div className="flex justify-center mt-1.5">
          <PronunciationJudge
            text={currentSubtitle.primary}
            language={film.language ?? "fr"}
          />
        </div>
      </div>
    );

    const pcNudge = (
      <div className="px-3 py-2 bg-muted/40 text-muted-foreground text-[11px] text-center border-t border-white/5">
        💻 For the best experience, try LinguaScript on a laptop or PC
      </div>
    );

    // One stable tree for portrait AND landscape: rotating the phone must
    // never unmount the YouTube player (that was killing playback sideways).
    return (
      <div className={cn("bg-black flex flex-col", isLandscape ? "h-[100dvh] overflow-hidden" : "min-h-screen")}>
        {!isLandscape && header}
        <div className={cn("flex w-full", isLandscape ? "flex-1 flex-row min-h-0" : "flex-col")}>
          <div
            className={cn("min-w-0 flex items-center justify-center bg-black", isLandscape && "flex-[7] h-full")}
            style={isLandscape ? { ["--ls-h" as any]: "100dvh" } : undefined}
          >
            <div className={cn("w-full", isLandscape && "h-full flex items-center justify-center")}>
              {videoBlock}
            </div>
          </div>
          <div className={cn("min-w-0", isLandscape && "flex-[3] h-full overflow-y-auto flex flex-col")}>
            {isLandscape && (
              <div className="flex items-center gap-1 p-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => navigate("/discover")} className="text-white hover:bg-white/10 h-8 w-8" aria-label="Back">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant={subtitleMode === "dual" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
                  className={cn("h-7 px-2 text-[11px] ml-auto", subtitleMode !== "dual" && "text-white hover:bg-white/10")}
                >
                  {subtitleMode === "dual" ? "Dual: ON" : "Dual: OFF"}
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10 h-8 w-8" aria-label="Fullscreen">
                  {cssFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </Button>
              </div>
            )}
            {user && (
              <div className="px-2 pt-2">
                <WatchWordCounter
                  savedToday={dailyGoal.savedToday}
                  goal={dailyGoal.goal}
                  onReview={() => navigate("/flashcards?focus=today")}
                />
              </div>
            )}
            {subtitleBlock}
            {!isLandscape && pcNudge}
          </div>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black flex flex-col">
      {user && <WatchGoalGate goal={dailyGoal.goal} playerRef={playerRef} savedToday={dailyGoal.savedToday} />}
      <div className="flex items-center gap-3 p-4 bg-black/80 backdrop-blur z-20">
        <Button data-tour="page-back" variant="ghost" size="icon" onClick={() => navigate("/discover")} className="text-white hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate">{film.title}</h1>
          <p className="text-white/60 text-sm">
            {getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}
          </p>
        </div>
        <DailyGoalTally
          savedToday={dailyGoal.savedToday}
          goal={dailyGoal.goal}
          className="hidden sm:inline-flex"
        />
        <ActiveLanguageBadge variant="dark" />
        <div className="flex items-center gap-2">
          {captionsLoading && <Loader2 className="w-4 h-4 text-white/60 animate-spin" />}
          <Button
            data-tour="dual-toggle"
            variant={subtitleMode === "dual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
            className={subtitleMode !== "dual" ? "text-white hover:bg-white/10" : ""}
          >
            {subtitleMode === "dual" ? "Dual subtitles: ON" : "Dual subtitles: OFF"}
          </Button>
          {subtitles.length > 0 && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => downloadSrt("primary")} className="text-white/70 hover:bg-white/10 gap-1 text-xs">
                <Download className="w-3 h-3" /> Original
              </Button>
              <Button variant="ghost" size="sm" onClick={() => downloadSrt("secondary")} className="text-white/70 hover:bg-white/10 gap-1 text-xs">
                <Download className="w-3 h-3" /> Translation
              </Button>
            </div>
          )}
          <Button data-tour="fullscreen-btn" variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10">
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center bg-black px-3 sm:px-6 py-2 sm:py-4">
        {/* Fullscreen wrapper — subtitles are INSIDE this so they persist in fullscreen */}
        <div
          ref={videoContainerRef}
          className={cn(
            "relative w-full bg-black overflow-hidden",
            isFullscreen
              ? "h-full flex items-center justify-center"
              : "max-w-5xl aspect-video max-h-[60vh] sm:max-h-[78vh] rounded-2xl shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] ring-1 ring-white/5 mx-auto my-auto"
          )}
        >
          <div id="yt-player" className={cn("w-full", isFullscreen ? "h-full" : "h-full")} />

          {/* Pre-roll house ad — masks YT iframe load */}
          {!adDone && (subtitles.length ? (
            <PreTeachCard
              lines={preTeachLines}
              language={film.language || learningLanguage || "fr"}
              level={(languageContext as any)?.cefrLevel ?? (film as any).cefr_level ?? null}
              goal={dailyGoal.goal}
              userId={user?.id}
              onComplete={finishPreTeach}
              onWords={handlePreTeachWords}
            />
          ) : <ChameleonLoader onComplete={finishPreTeach} duration={captionsLoading ? 12000 : 5000} />)}

          {/* Loading status */}
          {captionsLoading && captionsStatus && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white/80 text-sm px-4 py-2 rounded-lg flex items-center gap-2 z-[9999]">
              <Loader2 className="w-3 h-3 animate-spin" />
              {captionsStatus}
            </div>
          )}

          {captionsError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive/80 text-destructive-foreground text-sm px-4 py-2 rounded-lg z-[9999]">
              {captionsError}
            </div>
          )}

          {/* Subtitle overlay — rendered OUTSIDE the iframe but INSIDE the fullscreen container */}
          {currentSubtitle && (
            <div className="absolute bottom-[12%] sm:bottom-[8%] left-0 right-0 px-4 z-[9999] pointer-events-auto">
              <SubtitleOverlay
                primaryText={currentSubtitle.primary}
                secondaryText={currentSubtitle.secondary}
                words={currentSubtitle.words}
                targetWords={targetWords}
                mode={subtitleMode}
                onSaveWord={saveWordToFlashcards}
                onSavePhrase={savePhrase}
          onMarkKnown={markWordKnown}
                nativeLanguage={nativeLanguage}
                contentLanguage={learningLanguage || film.language || "fr"}
              />
            </div>
          )}

          {/* In-video gap challenge — playback is paused while this is up. */}
          {challenge && (
            <div className="absolute inset-0 z-[10000] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
              <GapFillChallenge
                words={challenge.words}
                gapIndex={challenge.gapIndex}
                distractors={challenge.distractors}
                tier="orange"
                translation={challenge.translation}
                onComplete={() => {
                  // Correct recall promotes the word to known, then playback resumes.
                  void markWordKnown({ text: challenge.answer });
                  resumeFromChallenge();
                }}
                onSkip={resumeFromChallenge}
              />
            </div>
          )}

        </div>
        {user && !isFullscreen && (
          <WatchWordCounter
            savedToday={dailyGoal.savedToday}
            goal={dailyGoal.goal}
            onReview={() => navigate("/flashcards?focus=today")}
            className="max-w-5xl mt-3"
          />
        )}
      </div>

      {showReinforce && comprehension && film && (
        <WatchResultsModal
          open={showReinforce}
          filmId={film.id}
          filmTitle={film.title}
          language={(film.is_public ? (film.language || learningLanguage) : learningLanguage) || "fr"}
          result={sessionResult}
          comprehension={comprehension}
          durationMinutes={sessionDurationMin}
          onClose={() => {
            setShowReinforce(false);
            // A video-count pet (10 / 25 videos) shows after the results, not over them.
            checkPetMilestones();
          }}
          onReview={() => {
            setReinforcementPending();
            setShowReinforce(false);
            checkPetMilestones();
            navigate("/flashcards");
          }}
        />
      )}

      <LearningBreakModal
        open={showLearningBreak}
        words={sessionSavedRef.current}
        onClose={() => setShowLearningBreak(false)}
        onResume={() => {
          setShowLearningBreak(false);
          try { playerRef.current?.playVideo?.(); } catch { /* noop */ }
        }}
      />
    </div>
  );
};

export default Watch;
