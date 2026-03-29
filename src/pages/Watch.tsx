import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

interface FilmData {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
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

function subtitlesToSrt(subtitles: DisplaySubtitle[], textKey: "primary" | "secondary"): string {
  return subtitles
    .map((s, i) => {
      const text = textKey === "primary" ? s.primary : s.secondary;
      if (!text) return null;
      const formatTime = (t: number) => {
        const h = Math.floor(t / 3600);
        const m = Math.floor((t % 3600) / 60);
        const sec = Math.floor(t % 60);
        const ms = Math.round((t % 1) * 1000);
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")},${ms.toString().padStart(3, "0")}`;
      };
      return `${i + 1}\n${formatTime(s.start)} --> ${formatTime(s.end)}\n${text}\n`;
    })
    .filter(Boolean)
    .join("\n");
}

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
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const [film, setFilm] = useState<FilmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [apiReady, setApiReady] = useState(!!window.YT?.Player);
  const [subtitles, setSubtitles] = useState<DisplaySubtitle[]>([]);
  const [captionsLoading, setCaptionsLoading] = useState(false);
  const [captionsError, setCaptionsError] = useState<string | null>(null);

  // Track watch time
  const watchStartRef = useRef<number | null>(null);

  // Load film
  useEffect(() => {
    if (!id) return;
    supabase.from("films").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setFilm(data);
      setLoading(false);
    });
  }, [id]);

  // Fetch subtitles
  useEffect(() => {
    if (!film) return;
    setCaptionsLoading(true);
    setCaptionsError(null);

    const filmLang = film.language || learningLanguage || "fr";
    const secondaryLang = "en";

    Promise.all([
      supabase.from("subtitles").select("*").eq("film_id", film.id).eq("language", filmLang).order("sort_order", { ascending: true }),
      supabase.from("subtitles").select("*").eq("film_id", film.id).eq("language", secondaryLang).order("sort_order", { ascending: true }),
    ]).then(([primaryRes, secondaryRes]) => {
      const primarySubs = primaryRes.data || [];
      const secondarySubs = secondaryRes.data || [];

      if (primarySubs.length > 0) {
        const display: DisplaySubtitle[] = primarySubs.map((s, i) => {
          const match = secondarySubs.find((t) => Math.abs(t.start_time - s.start_time) < 1.5);
          return {
            start: s.start_time,
            end: s.end_time,
            primary: s.text,
            secondary: match?.text || s.translation || "",
            words: textToWords(s.text, i),
          };
        });
        setSubtitles(display);
        setCaptionsLoading(false);
        return;
      }

      // Fallback: fetch from YouTube
      const ytId = getYouTubeId(film.url);
      if (!ytId) {
        setCaptionsLoading(false);
        setCaptionsError("No subtitles available");
        return;
      }

      supabase.functions
        .invoke("fetch-captions", { body: { videoId: ytId, language: filmLang } })
        .then(async ({ data, error }) => {
          if (error) {
            setCaptionsLoading(false);
            setCaptionsError("Could not load captions");
            return;
          }
          if (data?.subtitles?.length) {
            const display: DisplaySubtitle[] = data.subtitles.map((c: any, i: number) => ({
              start: c.start,
              end: c.end,
              primary: c.text,
              secondary: "",
              words: textToWords(c.text, i),
            }));
            setSubtitles(display);
            setCaptionsLoading(false);

            // Translate in background
            const filmLangLabel = getLanguageLabel(filmLang);
            const userLang = "English";
            if (filmLangLabel.toLowerCase() !== userLang.toLowerCase()) {
              supabase.functions
                .invoke("translate-subtitles", {
                  body: { subtitles: data.subtitles, fromLanguage: filmLangLabel, toLanguage: userLang },
                })
                .then(({ data: transData }) => {
                  if (transData?.translations) {
                    setSubtitles((prev) =>
                      prev.map((s, i) => ({
                        ...s,
                        secondary: transData.translations[i]?.translation || "",
                      }))
                    );
                  }
                });
            }
          } else {
            setCaptionsLoading(false);
            setCaptionsError("No captions available for this video");
          }
        });
    });
  }, [film, learningLanguage]);

  // Load YouTube API
  useEffect(() => {
    if (window.YT?.Player) { setApiReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  // Create player
  useEffect(() => {
    if (!apiReady || !film) return;
    const ytId = getYouTubeId(film.url);
    if (!ytId) return;

    playerRef.current = new window.YT.Player("yt-player", {
      videoId: ytId,
      width: "100%",
      height: "100%",
      playerVars: { autoplay: 0, controls: 1, modestbranding: 1, rel: 0 },
      events: {
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
            // Log watch time
            if (watchStartRef.current && user) {
              const minutesWatched = Math.round((Date.now() - watchStartRef.current) / 60000);
              if (minutesWatched > 0) {
                logWatchTime(minutesWatched);
              }
              watchStartRef.current = null;
            }
          }
        },
      },
    });

    return () => { clearInterval(intervalRef.current); };
  }, [apiReady, film]);

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
        user_id: user.id,
        date: today,
        minutes_watched: minutes,
        videos_watched: 1,
      });
    }
  };

  const downloadSrt = (type: "primary" | "secondary") => {
    const srtContent = subtitlesToSrt(subtitles, type);
    if (!srtContent) return;
    const blob = new Blob([srtContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const langSuffix = type === "primary" ? (film?.language || "original") : "en";
    a.download = `${film?.title || "subtitles"}_${langSuffix}.srt`;
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
            variant={subtitleMode === "dual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
            className={subtitleMode !== "dual" ? "text-white hover:bg-white/10" : ""}
          >
            {subtitleMode === "dual" ? "Dual" : "Single"}
          </Button>
          {subtitles.length > 0 && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadSrt("primary")}
                className="text-white/70 hover:bg-white/10 gap-1 text-xs"
              >
                <Download className="w-3 h-3" />
                Original
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => downloadSrt("secondary")}
                className="text-white/70 hover:bg-white/10 gap-1 text-xs"
              >
                <Download className="w-3 h-3" />
                Translation
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="relative flex-1 flex flex-col items-center justify-center bg-black">
        <div className="w-full max-w-5xl aspect-video relative">
          <div id="yt-player" className="w-full h-full" />

          {captionsError && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-destructive/80 text-destructive-foreground text-sm px-4 py-2 rounded-lg">
              {captionsError}
            </div>
          )}

          {currentSubtitle && (
            <div className="absolute bottom-2 left-0 right-0 px-4 z-10 pointer-events-auto">
              <SubtitleOverlay
                primaryText={currentSubtitle.primary}
                secondaryText={currentSubtitle.secondary}
                words={currentSubtitle.words}
                mode={subtitleMode}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Watch;
