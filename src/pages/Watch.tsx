import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Download, Maximize, Minimize } from "lucide-react";
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
  if (!primary.length || (primaryLang !== secondaryLang && !secondary.length)) {
    onStatus(`Downloading ${getLanguageLabel(primaryLang)} & ${getLanguageLabel(secondaryLang)} captions…`);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-captions", {
        body: { videoId, language: primaryLang, nativeLanguage: secondaryLang },
      });
      if (!error && data) {
        if (!primary.length && data.subtitles?.length) {
          primary = data.subtitles;
          await persistTrack(filmId, primaryLang, primary);
        }
        if (primaryLang !== secondaryLang && !secondary.length && data.nativeSubtitles?.length) {
          secondary = data.nativeSubtitles;
          await persistTrack(filmId, secondaryLang, secondary);
        }
      }
    } catch (e) {
      console.warn("Edge caption fetch failed:", e);
    }

    // Fallback: AI translate if one track still missing
    if (primary.length && !secondary.length && primaryLang !== secondaryLang) {
      onStatus(`Translating to ${getLanguageLabel(secondaryLang)}…`);
      secondary = await translateTrack(primary, primaryLang, secondaryLang);
      if (secondary.length) await persistTrack(filmId, secondaryLang, secondary);
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
  const { learningLanguage } = useLanguage();
  const { registerPlayer, active: tourActive } = useTour();
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const [film, setFilm] = useState<FilmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [apiReady, setApiReady] = useState(!!window.YT?.Player);
  const [subtitles, setSubtitles] = useState<DisplaySubtitle[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsStatus, setCaptionsStatus] = useState<string | null>(null);
  const [captionsError, setCaptionsError] = useState<string | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Skip the pre-roll house ad during the guided onboarding tour for a
  // frictionless first impression. The first thing the new user sees should
  // be the video + the teaching cursor, never an ad.
  const [adDone, setAdDone] = useState(tourActive);

  const toggleFullscreen = useCallback(() => {
    const container = videoContainerRef.current;
    if (!container) return;
    const fsEl = document.fullscreenElement || (document as any).webkitFullscreenElement;
    if (fsEl) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) (document as any).webkitExitFullscreen();
    } else {
      if (container.requestFullscreen) container.requestFullscreen();
      else if ((container as any).webkitRequestFullscreen) (container as any).webkitRequestFullscreen();
    }
  }, []);

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

      const { primary, secondary } = await loadAllCaptions(
        film.id, ytId, primaryLang, secondaryLang,
        (msg) => { if (!cancelled) setCaptionsStatus(msg); },
      );

      if (cancelled) return;

      if (primary.length > 0) {
        setSubtitles(buildDisplaySubtitles(primary, secondary));
        setCaptionsStatus(null);
      } else {
        setCaptionsError(`Could not load ${getLanguageLabel(primaryLang)} captions for this video`);
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
      playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0, cc_load_policy: 0 },
      events: {
        onReady: () => { registerPlayer(playerRef.current); },
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
          }
        },
      },
    });

    return () => { clearInterval(intervalRef.current); };
  }, [apiReady, film, adDone]);

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
    if (!user || !film) return;

    let { translation, pronunciation, ipa } = word;
    const context = currentSubtitle?.primary || "";
    const langCode = learningLanguage || film.language || "fr";
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

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <div className="flex items-center gap-3 p-4 bg-black/80 backdrop-blur z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate("/browse")} className="text-white hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate">{film.title}</h1>
          <p className="text-white/60 text-sm">
            {getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}
          </p>
        </div>
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
                nativeLanguage={nativeLanguage}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Watch;
