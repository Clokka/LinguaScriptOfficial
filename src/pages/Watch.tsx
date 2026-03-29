import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import {
  ensureSubtitleTracks,
  persistSubtitleTrack,
  translateSubtitleTrack,
  type SubtitleSegment,
} from "@/lib/subtitleSync";

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

function buildDisplaySubtitles(primaryTrack: SubtitleSegment[], secondaryTrack: SubtitleSegment[]): DisplaySubtitle[] {
  return primaryTrack.map((subtitle, index) => {
    const match = secondaryTrack.find((candidate) => Math.abs(candidate.start - subtitle.start) < 1.5);

    return {
      start: subtitle.start,
      end: subtitle.end,
      primary: subtitle.text,
      secondary: match?.text || "",
      words: textToWords(subtitle.text, index),
    };
  });
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
  const [nativeLanguage, setNativeLanguage] = useState("en");

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

  useEffect(() => {
    if (!user) {
      setNativeLanguage("en");
      return;
    }

    supabase
      .from("profiles")
      .select("native_language")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.native_language) {
          setNativeLanguage(data.native_language);
        }
      });
  }, [user]);

  // Client-side caption fetching (bypasses server-side YouTube blocks)
  const fetchCaptionsClientSide = async (ytId: string, lang: string): Promise<{start: number; end: number; text: string}[]> => {
    const parseXml = (xml: string) => {
      const subs: {start: number; end: number; text: string}[] = [];
      const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>(.*?)<\/text>/gs;
      let match;
      while ((match = regex.exec(xml)) !== null) {
        const start = parseFloat(match[1]);
        const dur = parseFloat(match[2]);
        const text = match[3]
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, '').trim();
        if (text) subs.push({ start, end: start + dur, text });
      }
      return subs;
    };

    // Try direct timedtext URLs from the user's browser
    const urls = [
      `https://www.youtube.com/api/timedtext?v=${ytId}&lang=${lang}&fmt=srv3`,
      `https://www.youtube.com/api/timedtext?v=${ytId}&lang=${lang}&fmt=srv3&kind=asr`,
    ];
    if (lang !== 'en') {
      urls.push(
        `https://www.youtube.com/api/timedtext?v=${ytId}&lang=en&fmt=srv3`,
        `https://www.youtube.com/api/timedtext?v=${ytId}&lang=en&fmt=srv3&kind=asr`,
      );
    }

    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (res.ok) {
          const xml = await res.text();
          const subs = parseXml(xml);
          if (subs.length > 0) return subs;
        }
      } catch {}
    }
    return [];
  };

  // Fetch subtitles
  useEffect(() => {
    if (!film) return;
    let cancelled = false;

    const loadCaptions = async () => {
      setCaptionsLoading(true);
      setCaptionsError(null);

      const primaryLanguage = film.language || learningLanguage || "fr";
      const secondaryLanguage = nativeLanguage || "en";
      const ytId = getYouTubeId(film.url);

      if (!ytId) {
        if (!cancelled) {
          setCaptionsLoading(false);
          setCaptionsError("No subtitles available");
        }
        return;
      }

      const storedTracks = await ensureSubtitleTracks({
        filmId: film.id,
        videoId: ytId,
        primaryLanguage,
        secondaryLanguage,
      });

      if (storedTracks.primary.length > 0) {
        if (!cancelled) {
          setSubtitles(buildDisplaySubtitles(storedTracks.primary, storedTracks.secondary));
          setCaptionsLoading(false);
        }
        return;
      }

      const clientPrimary = await fetchCaptionsClientSide(ytId, primaryLanguage);
      if (clientPrimary.length > 0) {
        await persistSubtitleTrack(film.id, primaryLanguage, clientPrimary);

        let secondaryTrack: SubtitleSegment[] = [];
        if (secondaryLanguage !== primaryLanguage) {
          secondaryTrack = await translateSubtitleTrack(clientPrimary, primaryLanguage, secondaryLanguage);
          if (secondaryTrack.length > 0) {
            await persistSubtitleTrack(film.id, secondaryLanguage, secondaryTrack);
          }
        }

        if (!cancelled) {
          setSubtitles(buildDisplaySubtitles(clientPrimary, secondaryTrack));
          setCaptionsLoading(false);
        }
        return;
      }

      if (!cancelled) {
        setCaptionsLoading(false);
        setCaptionsError(`Could not load ${getLanguageLabel(primaryLanguage)} captions for this video`);
      }
    };

    void loadCaptions();

    return () => {
      cancelled = true;
    };
  }, [film, learningLanguage, nativeLanguage]);

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
    const langSuffix = type === "primary" ? (film?.language || learningLanguage || "original") : nativeLanguage;
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
