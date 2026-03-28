import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Play, Pause, Volume2, VolumeX, Maximize, Minimize, Settings } from "lucide-react";
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

const mockSubtitles = [
  {
    time: 0,
    primary: "¿Cómo te llamas?",
    secondary: "What is your name?",
    words: [
      { id: "1", text: "Cómo", translation: "How/What", pronunciation: "KOH-moh", ipa: "/ˈko.mo/" },
      { id: "2", text: "te", translation: "yourself", pronunciation: "teh", ipa: "/te/" },
      { id: "3", text: "llamas", translation: "are called", pronunciation: "YAH-mahs", ipa: "/ˈʎa.mas/" },
    ],
  },
  {
    time: 3,
    primary: "Me llamo Carlos. Mucho gusto.",
    secondary: "My name is Carlos. Nice to meet you.",
    words: [
      { id: "4", text: "Me", translation: "Myself", pronunciation: "meh", ipa: "/me/" },
      { id: "5", text: "llamo", translation: "am called", pronunciation: "YAH-moh", ipa: "/ˈʎa.mo/" },
      { id: "6", text: "Mucho", translation: "Much/A lot", pronunciation: "MOO-choh", ipa: "/ˈmu.tʃo/" },
      { id: "7", text: "gusto", translation: "pleasure", pronunciation: "GOOS-toh", ipa: "/ˈɡus.to/" },
    ],
  },
  {
    time: 6,
    primary: "El gusto es mío. ¿De dónde eres?",
    secondary: "The pleasure is mine. Where are you from?",
    words: [
      { id: "8", text: "gusto", translation: "pleasure", pronunciation: "GOOS-toh", ipa: "/ˈɡus.to/" },
      { id: "9", text: "mío", translation: "mine", pronunciation: "MEE-oh", ipa: "/ˈmi.o/" },
      { id: "10", text: "dónde", translation: "where", pronunciation: "DOHN-deh", ipa: "/ˈdon.de/" },
      { id: "11", text: "eres", translation: "are (you)", pronunciation: "EH-rehs", ipa: "/ˈe.ɾes/" },
    ],
  },
];

const Watch = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [film, setFilm] = useState<FilmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [currentSubtitle, setCurrentSubtitle] = useState(mockSubtitles[0]);

  useEffect(() => {
    if (!id) return;
    supabase
      .from("films")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (data) setFilm(data);
        setLoading(false);
      });
  }, [id]);

  // Update subtitle based on video time
  useEffect(() => {
    const subtitleIndex = Math.floor(currentTime / 3) % mockSubtitles.length;
    setCurrentSubtitle(mockSubtitles[subtitleIndex]);
  }, [currentTime]);

  // Hide controls after inactivity
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    if (isPlaying && showControls) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [isPlaying, showControls]);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = ratio * duration;
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

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
          <Button variant="glass" onClick={() => navigate("/")}>Go Home</Button>
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
            {getLanguageFlag(film.language ?? "es")} {getLanguageLabel(film.language ?? "es")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DifficultyStars difficulty={2} />
        </div>
      </div>

      {/* Video container */}
      <div
        ref={containerRef}
        className="relative flex-1 flex items-center justify-center bg-black cursor-pointer"
        onMouseMove={() => setShowControls(true)}
        onClick={togglePlay}
      >
        <video
          ref={videoRef}
          src={film.url}
          className="w-full h-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Play overlay when paused */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <Play className="w-10 h-10 text-white ml-1" fill="white" />
            </div>
          </div>
        )}

        {/* Subtitle overlay */}
        <div className="absolute bottom-24 left-0 right-0 px-4 z-10" onClick={(e) => e.stopPropagation()}>
          <SubtitleOverlay
            primaryText={currentSubtitle.primary}
            secondaryText={currentSubtitle.secondary}
            words={currentSubtitle.words}
            mode={subtitleMode}
          />
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        {/* Controls */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300 z-10",
            showControls ? "opacity-100" : "opacity-0"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Progress bar */}
          <div
            className="h-1 bg-white/20 rounded-full mb-4 cursor-pointer group/progress hover:h-2 transition-all"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="text-white hover:bg-white/10">
                {isPlaying ? <Pause className="w-5 h-5" fill="white" /> : <Play className="w-5 h-5 ml-0.5" fill="white" />}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleMute} className="text-white hover:bg-white/10">
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <span className="text-sm text-white/60 ml-2">
                {formatTime(currentTime)} / {formatTime(duration || 0)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant={subtitleMode === "dual" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
                className={subtitleMode !== "dual" ? "text-white hover:bg-white/10" : ""}
              >
                {subtitleMode === "dual" ? "Dual" : "Single"}
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white hover:bg-white/10">
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Watch;
