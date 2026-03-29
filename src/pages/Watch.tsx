import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import { DifficultyStars } from "@/components/DifficultyStars";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";

interface FilmData {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
}

interface SubtitleEntry {
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

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

const Watch = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const [film, setFilm] = useState<FilmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [apiReady, setApiReady] = useState(!!window.YT?.Player);

  // Load film data
  useEffect(() => {
    if (!id) return;
    supabase.from("films").select("*").eq("id", id).single().then(({ data }) => {
      if (data) setFilm(data);
      setLoading(false);
    });
  }, [id]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (window.YT?.Player) { setApiReady(true); return; }
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = () => setApiReady(true);
  }, []);

  // Create player when API ready and film loaded
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
            intervalRef.current = setInterval(() => {
              if (playerRef.current?.getCurrentTime) {
                setCurrentTime(playerRef.current.getCurrentTime());
              }
            }, 250);
          } else {
            clearInterval(intervalRef.current);
          }
        },
      },
    });

    return () => { clearInterval(intervalRef.current); };
  }, [apiReady, film]);

  // Find current subtitle
  const currentSubtitle = frenchSubtitles.find(
    (s) => currentTime >= s.start && currentTime < s.end
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading film...</div>
      </div>
    );
  }

  if (!film) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Film not found</p>
          <Button variant="ghost" onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-3 p-4 bg-black/80 backdrop-blur z-20">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="text-white hover:bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-semibold truncate">{film.title}</h1>
          <p className="text-white/60 text-sm">
            {getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={subtitleMode === "dual" ? "default" : "ghost"}
            size="sm"
            onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
            className={subtitleMode !== "dual" ? "text-white hover:bg-white/10" : ""}
          >
            {subtitleMode === "dual" ? "Dual Subs" : "Single Sub"}
          </Button>
          <DifficultyStars difficulty={2} />
        </div>
      </div>

      {/* Video container */}
      <div ref={containerRef} className="relative flex-1 flex flex-col items-center justify-center bg-black">
        <div className="w-full max-w-5xl aspect-video relative">
          <div id="yt-player" className="w-full h-full" />

          {/* Subtitle overlay */}
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
