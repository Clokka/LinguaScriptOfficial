import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Download, Maximize, Minimize, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTour } from "@/contexts/TourContext";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { fetchCaptionsFromBrowser } from "@/lib/browserCaptionFetcher";
import { AdLoader } from "@/components/AdLoader";
import { ContentLockScreen } from "@/components/ContentLockScreen";
import { ActiveLanguageBadge } from "@/components/ActiveLanguageBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { saveGuestWord } from "@/lib/guestWords";
import { useXp } from "@/contexts/XpContext";
import { recordDailyVideoWatch, setReinforcementPending } from "@/lib/dailyVideo";
import { toast } from "sonner";

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
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/))([^&?\s]+)/);
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
  try {
    const { data, error } = await supabase.functions.invoke("translate-subtitles", {
      body: { subtitles: subs, fromLanguage: getLanguageLabel(from), toLanguage: getLanguageLabel(to) },
    });
    if (error || !data?.translations?.length) return [];
    return subs
      .map((s, i) => ({ ...s, text: data.translations[i]?.translation || "" }))
      .filter((s) => s.text.trim().length > 0);
  } catch {
    return [];
  }
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
): Promise<{ primary: SubtitleSegment[]; secondary: SubtitleSegment[] }> {
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

  if (primary.length > 0 && (primaryLang === secondaryLang || secondary.length > 0)) {
    return { primary, secondary };
  }

  // 2) Fetch via edge function (proxies InnerTube + tlang to avoid CORS)
  let edgeFailure: string | null = null;
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
        if (!primary.length && data.subtitles?.length) {
          primary = data.subtitles;
          await persistTrack(filmId, primaryLang, primary);
        }
        if (primaryLang !== secondaryLang && !secondary.length && data.nativeSubtitles?.length) {
          secondary = data.nativeSubtitles;
          await persistTrack(filmId, secondaryLang, secondary);
        }
      }
    } catch (e: any) {
      edgeFailure = e?.message || "Caption service failed";
      console.warn("Edge caption fetch failed:", e);
    }

    // Fallback A: browser-side InnerTube fetch (bypasses paid provider quotas).
    if (!primary.length || (primaryLang !== secondaryLang && !secondary.length)) {
      onStatus("Provider unavailable — trying direct fetch…");
      try {
        const browserRes = await fetchCaptionsFromBrowser(videoId, primaryLang, secondaryLang);
        if (!primary.length && browserRes.learning.length) {
          primary = browserRes.learning;
          await persistTrack(filmId, primaryLang, primary);
        }
        if (primaryLang !== secondaryLang && !secondary.length && browserRes.native.length) {
          secondary = browserRes.native;
          await persistTrack(filmId, secondaryLang, secondary);
        }
      } catch (e) {
        console.warn("Browser caption fallback failed:", e);
      }
    }

    // Fallback B: AI translate if one track still missing
    if (primary.length && !secondary.length && primaryLang !== secondaryLang) {
      onStatus(`Translating to ${getLanguageLabel(secondaryLang)}…`);
      secondary = await translateTrack(primary, primaryLang, secondaryLang);
      if (secondary.length) await persistTrack(filmId, secondaryLang, secondary);
    }

    if (!primary.length && edgeFailure) {
      // Surface via thrown error so caller can show it.
      throw new Error(edgeFailure);
    }
  }

  return { primary, secondary: primaryLang === secondaryLang ? primary : secondary };
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
  const { learningLanguage, languageContext, isContentLocked } = useLanguage();
  const { award } = useXp();
  const videoWatchAwardedRef = useRef(false);
  const { registerPlayer, active: tourActive, step: tourStep } = useTour();
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();
  const historyIntervalRef = useRef<ReturnType<typeof setInterval>>();

  const [film, setFilm] = useState<FilmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [showReinforce, setShowReinforce] = useState(false);
  const [apiReady, setApiReady] = useState(!!window.YT?.Player);
  const [subtitles, setSubtitles] = useState<DisplaySubtitle[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsStatus, setCaptionsStatus] = useState<string | null>(null);
  const [captionsError, setCaptionsError] = useState<string | null>(null);
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
      const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
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
      try {
        const res = await loadAllCaptions(
          film.id, ytId, primaryLang, secondaryLang,
          (msg) => { if (!cancelled) setCaptionsStatus(msg); },
        );
        primary = res.primary;
        secondary = res.secondary;
      } catch (e: any) {
        loadError = e?.message || "Caption fetch failed";
      }

      if (cancelled) return;

      if (primary.length > 0) {
        setSubtitles(buildDisplaySubtitles(primary, secondary));
        setCaptionsStatus(null);
      } else {
        const detail = loadError ? ` (${loadError})` : "";
        setCaptionsError(
          `Could not load ${getLanguageLabel(primaryLang)} captions for this video${detail}. ` +
          `YouTube may not provide captions for it, or our caption provider is at its daily limit. Please try another video.`,
        );
      }
      setCaptionsLoading(false);
    };

    void run();
    return () => { cancelled = true; };
  }, [film, learningLanguage, nativeLanguage]);

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
            if (event.data === window.YT.PlayerState.ENDED && !videoWatchAwardedRef.current) {
              videoWatchAwardedRef.current = true;
              award("video_watch", { videoId: film?.id });
              if (user && film) void recordDailyVideoWatch(user.id, film.id);
              setShowReinforce(true);
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
    const langCode = learningLanguage || film?.language || "fr";
    const fromLang = getLanguageLabel(langCode);
    const toLang = getLanguageLabel(nativeLanguage);

    // If translation is empty, fetch it from AI
    if (!translation) {
      try {
        const { data, error } = await supabase.functions.invoke("translate-word", {
          body: { word: word.text, context, fromLanguage: fromLang, toLanguage: toLang },
        });
        if (!error && data) {
          translation = data.translation || "";
          pronunciation = data.pronunciation || "";
          ipa = data.ipa || "";
        }
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
      return;
    }

    if (!film) return;
    await supabase.from("saved_words").upsert({
      user_id: user.id,
      word: word.text,
      translation,
      pronunciation,
      ipa,
      context,
      film_id: film.id,
      language: langCode,
    }, { onConflict: "user_id,word,language" });
    award("add_word");
  };

  const markWordKnown = async (word: { text: string; translation?: string }) => {
    const langCode = learningLanguage || film?.language || "fr";
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
    await supabase.from("saved_words").upsert({
      user_id: user.id,
      word: word.text,
      translation: word.translation || "",
      context: currentSubtitle?.primary || "",
      film_id: film?.id,
      language: langCode,
      state: "green",
      state_changed_at: new Date().toISOString(),
    }, { onConflict: "user_id,word,language" });
    toast.success("Marked as known: " + word.text);
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
          <Button variant="ghost" onClick={() => navigate("/browse")}>Go Home</Button>
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
        onBack={() => navigate("/browse")}
        onUpgrade={() => navigate("/pricing")}
      />
    );
  }

  // ── MOBILE LAYOUT (<768px) — desktop layout below is untouched ──
  if (isMobile && !isFullscreen) {
    const header = (
      <div className="flex items-center gap-2 p-2 bg-black/80 backdrop-blur z-20">
        <Button data-tour="page-back" variant="ghost" size="icon" onClick={() => navigate("/browse")} className="text-white hover:bg-white/10 shrink-0 h-9 w-9">
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
        {!adDone && <AdLoader onComplete={() => setAdDone(true)} />}
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
          mode={subtitleMode}
          onSaveWord={saveWordToFlashcards}
          onMarkKnown={markWordKnown}
          nativeLanguage={nativeLanguage}
          contentLanguage={film.language ?? "fr"}
          className={isLandscape ? "!px-3 !py-2 [&_.subtitle-text]:!text-base" : "!px-4 !py-3 [&_.subtitle-text]:!text-lg"}
        />
      </div>
    );

    const pcNudge = (
      <div className="px-3 py-2 bg-muted/40 text-muted-foreground text-[11px] text-center border-t border-white/5">
        💻 For the best experience, try LinguaScript on a laptop or PC
      </div>
    );

    if (isLandscape) {
      return (
        <div className="min-h-screen bg-black flex flex-col">
          {isLandscape && !landscapeBannerDismissed && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-orange-500 text-white text-xs">
              <span>📱 Rotate to portrait for a better experience!</span>
              <button onClick={() => setLandscapeBannerDismissed(true)} aria-label="Dismiss" className="p-1 hover:bg-white/20 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {header}
          <div className="flex-1 flex flex-row gap-2 p-2 overflow-hidden">
            <div className="flex-[7] min-w-0 flex items-center">{videoBlock}</div>
            <div className="flex-[3] min-w-0 overflow-y-auto">{subtitleBlock}</div>
          </div>
          {pcNudge}
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-black flex flex-col">
        {header}
        <div className="flex flex-col w-full">
          {videoBlock}
          {subtitleBlock}
          {pcNudge}
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex items-center gap-3 p-4 bg-black/80 backdrop-blur z-20">
        <Button data-tour="page-back" variant="ghost" size="icon" onClick={() => navigate("/browse")} className="text-white hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate">{film.title}</h1>
          <p className="text-white/60 text-sm">
            {getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}
          </p>
        </div>
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
          {!adDone && <AdLoader onComplete={() => setAdDone(true)} />}

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
                mode={subtitleMode}
                onSaveWord={saveWordToFlashcards}
          onMarkKnown={markWordKnown}
                nativeLanguage={nativeLanguage}
                contentLanguage={film.language ?? "fr"}
              />
            </div>
          )}

        </div>
      </div>

      {showReinforce && (
        <div className="fixed inset-x-0 bottom-0 z-[80] p-4 pointer-events-none">
          <div className="glass-panel-strong max-w-md mx-auto p-5 pointer-events-auto animate-bounce-in shadow-float">
            <div className="text-sm uppercase tracking-widest text-primary mb-1">+10 XP</div>
            <h3 className="text-lg font-bold mb-1">Great learning session</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Want to reinforce what you just learned? Earn a bonus by reviewing flashcards now.
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => setShowReinforce(false)}>
                Later
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={() => {
                  setReinforcementPending();
                  setShowReinforce(false);
                  navigate("/flashcards");
                }}
              >
                Review now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Watch;
