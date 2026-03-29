import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Languages,
  Mic,
  BookOpen,
  Sparkles,
  Subtitles,
  Chrome,
  Film,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/NavBar";
import { FeatureCard } from "@/components/FeatureCard";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SubtitleOverlay } from "@/components/SubtitleOverlay";
import { StreakBadge } from "@/components/StreakBadge";
import { DifficultyStars } from "@/components/DifficultyStars";
import { FlashcardReview } from "@/components/FlashcardReview";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

type Tab = "demo" | "features" | "flashcards";

const demoWords = [
  { id: "1", text: "¿Cómo", translation: "How", pronunciation: "KOH-moh", ipa: "/ˈko.mo/" },
  { id: "2", text: "te", translation: "yourself", pronunciation: "teh", ipa: "/te/" },
  { id: "3", text: "llamas?", translation: "do you call?", pronunciation: "YAH-mahs", ipa: "/ˈʎa.mas/" },
];

const Landing = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("demo");
  const [latestFilm, setLatestFilm] = useState<{ title: string; language: string } | null>(null);
  const [filmCount, setFilmCount] = useState(0);

  useEffect(() => {
    supabase
      .from("films")
      .select("title, language")
      .order("created_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setLatestFilm(data[0]);
      });

    supabase
      .from("films")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count !== null) setFilmCount(count);
      });
  }, []);

  const languageFlags: Record<string, string> = {
    french: "🇫🇷",
    spanish: "🇪🇸",
    german: "🇩🇪",
    italian: "🇮🇹",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Languages className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">Ligua Overlay</span>
          </button>
          <NavBar />
        </div>
      </nav>

      {/* Now Available Banner */}
      {latestFilm && (
        <div className="max-w-7xl mx-auto px-6 mt-4">
          <button
            onClick={() => navigate("/browse")}
            className="w-full glass-panel p-4 flex items-center gap-4 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <Film className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 text-left">
              <span className="text-sm text-muted-foreground">Now Available: </span>
              <span className="text-sm font-semibold text-primary">{latestFilm.title}</span>
              <div className="text-xs text-muted-foreground mt-0.5">
                {languageFlags[latestFilm.language?.toLowerCase() ?? ""] ?? "🌍"}{" "}
                {latestFilm.language ? latestFilm.language.charAt(0).toUpperCase() + latestFilm.language.slice(1) : ""}
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{filmCount} film{filmCount !== 1 ? "s" : ""} available</span>
          </button>
        </div>
      )}

      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Turn any movie into a language lesson</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="text-foreground">Learn languages while</span>
            <br />
            <span className="gradient-text">streaming your favorites</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            A Chrome extension that overlays Netflix, YouTube, and more with
            interactive subtitles, flashcards, and gamification—without pausing the fun.
          </p>

          {/* Tab Buttons */}
          <div className="flex items-center justify-center gap-2 mb-12">
            <Button
              variant={activeTab === "demo" ? "default" : "ghost"}
              onClick={() => setActiveTab("demo")}
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              Live Demo
            </Button>
            <Button
              variant={activeTab === "features" ? "default" : "ghost"}
              onClick={() => setActiveTab("features")}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Features
            </Button>
            <Button
              variant={activeTab === "flashcards" ? "default" : "ghost"}
              onClick={() => setActiveTab("flashcards")}
              className="gap-2"
            >
              <BookOpen className="w-4 h-4" />
              Flashcards
            </Button>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        {activeTab === "demo" && (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* Video Player Mock */}
            <div className="flex-1 w-full">
              <div className="glass-panel-strong rounded-2xl overflow-hidden">
                {/* Video Area */}
                <div className="relative aspect-video bg-muted/30 flex items-center justify-center">
                  <div className="absolute top-4 right-4">
                    <StreakBadge streak={7} showAnimation={false} />
                  </div>
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4 hover:bg-muted/70 transition-colors cursor-pointer">
                      <Play className="w-8 h-8 text-muted-foreground ml-1" />
                    </div>
                    <p className="text-muted-foreground font-medium">Demo Video Player</p>
                    <p className="text-sm text-muted-foreground/60">Click play to see subtitles</p>
                  </div>
                  <div className="absolute top-4 left-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Difficulty:</span>
                      <DifficultyStars difficulty={2} maxStars={5} />
                    </div>
                  </div>
                </div>

                {/* Subtitle Overlay */}
                <div className="p-4">
                  <SubtitleOverlay
                    primaryText="¿Cómo te llamas?"
                    secondaryText="What is your name?"
                    words={demoWords}
                    mode="dual"
                  />
                </div>

                {/* Fake playbar */}
                <div className="px-4 pb-4 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>0:00</span>
                  <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div className="h-full w-0 bg-primary rounded-full" />
                  </div>
                  <span>0:09</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs">
                    Dual
                  </Button>
                </div>
              </div>
            </div>

            {/* Settings Panel */}
            <SettingsPanel className="hidden lg:block" />
          </div>
        )}

        {activeTab === "features" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <FeatureCard
              icon={Subtitles}
              title="Dual Subtitles"
              description="See the original language and your translation side by side in real time."
              gradient="primary"
            />
            <FeatureCard
              icon={Mic}
              title="Pronunciation"
              description="Hear any word spoken aloud in the correct accent with one click."
              gradient="accent"
            />
            <FeatureCard
              icon={BookOpen}
              title="Flashcards"
              description="Save words and review them later with spaced-repetition flashcards."
              gradient="success"
            />
            <FeatureCard
              icon={Languages}
              title="Multi-Language"
              description="Switch between French, Spanish, German, and Italian with one tap."
              gradient="primary"
            />
            <FeatureCard
              icon={Film}
              title="Works Everywhere"
              description="Overlay on Netflix, YouTube, Prime Video, Disney+, and more."
              gradient="accent"
            />
            <FeatureCard
              icon={Sparkles}
              title="Gamification"
              description="Earn XP, maintain streaks, and level up as you watch and learn."
              gradient="success"
            />
          </div>
        )}

        {activeTab === "flashcards" && (
          <div className="max-w-md mx-auto">
            <FlashcardReview />
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="border-t border-border">
        <div className="max-w-3xl mx-auto px-6 py-20 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Start learning while you watch
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of language learners who've discovered the joy of learning through entertainment.
          </p>
          <Button
            size="lg"
            onClick={() => navigate("/browse")}
            className="h-14 px-8 text-lg rounded-full bg-gradient-primary shadow-glow-primary hover:opacity-90 transition-opacity gap-3"
          >
            <Chrome className="w-5 h-5" />
            Add Ligua to Chrome — It's Free
            <ArrowRight className="w-5 h-5" />
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Works with Netflix, YouTube, Prime Video, Disney+, and more
          </p>
        </div>
      </section>
    </div>
  );
};

export default Landing;
