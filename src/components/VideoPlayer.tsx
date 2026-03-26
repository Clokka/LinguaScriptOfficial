import { useState, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Settings } from "lucide-react";
import { Button } from "./ui/button";
import { SubtitleOverlay } from "./SubtitleOverlay";
import { StreakBadge } from "./StreakBadge";
import { DifficultyStars } from "./DifficultyStars";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  className?: string;
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

export const VideoPlayer = ({ className }: VideoPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState(mockSubtitles[0]);
  const [subtitleMode, setSubtitleMode] = useState<"single" | "dual">("dual");
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const newTime = prev + 1;
          // Cycle through subtitles
          const subtitleIndex = Math.floor(newTime / 3) % mockSubtitles.length;
          setCurrentSubtitle(mockSubtitles[subtitleIndex]);
          return newTime >= 9 ? 0 : newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  return (
    <div
      className={cn(
        "relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-float group",
        className
      )}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => !isPlaying && setShowControls(true)}
    >
      {/* Fake video background */}
      <div className="absolute inset-0 bg-gradient-to-br from-secondary via-background to-muted flex items-center justify-center">
        <div className="text-center">
          <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4 mx-auto">
            <Play className="w-12 h-12 text-muted-foreground ml-1" />
          </div>
          <p className="text-muted-foreground text-lg">Demo Video Player</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Click play to see subtitles</p>
        </div>
      </div>

      {/* Gradient overlays for depth */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* Top right - Streak badge */}
      <div className="absolute top-4 right-4 z-10">
        <StreakBadge streak={7} />
      </div>

      {/* Bottom left - Difficulty */}
      <div className="absolute bottom-24 left-4 z-10 glass-panel px-3 py-2 flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Difficulty:</span>
        <DifficultyStars difficulty={2} />
      </div>

      {/* Subtitle overlay */}
      <div className="absolute bottom-20 left-0 right-0 px-4 z-10">
        <SubtitleOverlay
          primaryText={currentSubtitle.primary}
          secondaryText={currentSubtitle.secondary}
          words={currentSubtitle.words}
          mode={subtitleMode}
        />
      </div>

      {/* Video controls */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 p-4 transition-opacity duration-300",
          showControls ? "opacity-100" : "opacity-0"
        )}
      >
        {/* Progress bar */}
        <div className="h-1 bg-muted/50 rounded-full mb-4 cursor-pointer group/progress">
          <div
            className="h-full bg-primary rounded-full relative transition-all"
            style={{ width: `${(currentTime / 9) * 100}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="glass"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              )}
            </Button>
            <Button
              variant="glass"
              size="icon"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </Button>
            <span className="text-sm text-muted-foreground ml-2">
              0:{currentTime.toString().padStart(2, "0")} / 0:09
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={subtitleMode === "dual" ? "default" : "glass"}
              size="sm"
              onClick={() => setSubtitleMode(subtitleMode === "dual" ? "single" : "dual")}
            >
              {subtitleMode === "dual" ? "Dual" : "Single"}
            </Button>
            <Button variant="glass" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="glass" size="icon">
              <Maximize className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
