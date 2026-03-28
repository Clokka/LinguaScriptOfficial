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

// Hardcoded French subtitles synced to the video
const frenchSubtitles = [
  { start: 0, end: 4, primary: "Bonjour et bienvenue sur ma chaîne.", secondary: "Hello and welcome to my channel.", words: [
    { id: "1", text: "Bonjour", translation: "Hello", pronunciation: "bohn-ZHOOR", ipa: "/bɔ̃.ʒuʁ/" },
    { id: "2", text: "bienvenue", translation: "welcome", pronunciation: "byaN-vuh-NEW", ipa: "/bjɛ̃.və.ny/" },
    { id: "3", text: "chaîne", translation: "channel", pronunciation: "SHEHN", ipa: "/ʃɛn/" },
  ]},
  { start: 4, end: 8, primary: "Aujourd'hui, je vais vous parler de langues.", secondary: "Today, I'm going to talk to you about languages.", words: [
    { id: "4", text: "Aujourd'hui", translation: "Today", pronunciation: "oh-zhoor-DWEE", ipa: "/o.ʒuʁ.dɥi/" },
    { id: "5", text: "parler", translation: "to talk", pronunciation: "par-LAY", ipa: "/paʁ.le/" },
    { id: "6", text: "langues", translation: "languages", pronunciation: "LAHNG", ipa: "/lɑ̃ɡ/" },
  ]},
  { start: 8, end: 13, primary: "Je parle huit langues couramment.", secondary: "I speak eight languages fluently.", words: [
    { id: "7", text: "parle", translation: "speak", pronunciation: "PARL", ipa: "/paʁl/" },
    { id: "8", text: "huit", translation: "eight", pronunciation: "WEET", ipa: "/ɥit/" },
    { id: "9", text: "couramment", translation: "fluently", pronunciation: "koo-rah-MAHN", ipa: "/ku.ʁa.mɑ̃/" },
  ]},
  { start: 13, end: 18, primary: "Chaque langue a changé ma vie.", secondary: "Each language has changed my life.", words: [
    { id: "10", text: "Chaque", translation: "Each", pronunciation: "SHAHK", ipa: "/ʃak/" },
    { id: "11", text: "langue", translation: "language", pronunciation: "LAHNG", ipa: "/lɑ̃ɡ/" },
    { id: "12", text: "changé", translation: "changed", pronunciation: "shahn-ZHAY", ipa: "/ʃɑ̃.ʒe/" },
    { id: "13", text: "vie", translation: "life", pronunciation: "VEE", ipa: "/vi/" },
  ]},
  { start: 18, end: 23, primary: "L'apprentissage des langues ouvre des portes.", secondary: "Learning languages opens doors.", words: [
    { id: "14", text: "apprentissage", translation: "learning", pronunciation: "ah-prahn-tee-SAHZH", ipa: "/a.pʁɑ̃.ti.saʒ/" },
    { id: "15", text: "ouvre", translation: "opens", pronunciation: "OOVR", ipa: "/uvʁ/" },
    { id: "16", text: "portes", translation: "doors", pronunciation: "PORT", ipa: "/pɔʁt/" },
  ]},
  { start: 23, end: 28, primary: "On peut voyager et rencontrer des gens.", secondary: "You can travel and meet people.", words: [
    { id: "17", text: "voyager", translation: "to travel", pronunciation: "vwah-yah-ZHAY", ipa: "/vwa.ja.ʒe/" },
    { id: "18", text: "rencontrer", translation: "to meet", pronunciation: "rahn-kohn-TRAY", ipa: "/ʁɑ̃.kɔ̃.tʁe/" },
    { id: "19", text: "gens", translation: "people", pronunciation: "ZHAHN", ipa: "/ʒɑ̃/" },
  ]},
  { start: 28, end: 33, primary: "C'est une aventure incroyable.", secondary: "It's an incredible adventure.", words: [
    { id: "20", text: "aventure", translation: "adventure", pronunciation: "ah-vahn-TOOR", ipa: "/a.vɑ̃.tyʁ/" },
    { id: "21", text: "incroyable", translation: "incredible", pronunciation: "aN-kwah-YAHBL", ipa: "/ɛ̃.kʁwa.jabl/" },
  ]},
  { start: 33, end: 38, primary: "Je vous encourage à commencer aujourd'hui.", secondary: "I encourage you to start today.", words: [
    { id: "22", text: "encourage", translation: "encourage", pronunciation: "ahn-koo-RAZH", ipa: "/ɑ̃.ku.ʁaʒ/" },
    { id: "23", text: "commencer", translation: "to start", pronunciation: "koh-mahn-SAY", ipa: "/kɔ.mɑ̃.se/" },
  ]},
];

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
