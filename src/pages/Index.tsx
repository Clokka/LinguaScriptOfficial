import { useState } from "react";
import {
  Play,
  Subtitles,
  BookOpen,
  Flame,
  Star,
  Sparkles,
  Chrome,
  Layers,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VideoPlayer } from "@/components/VideoPlayer";
import { SettingsPanel } from "@/components/SettingsPanel";
import { FlashcardReview } from "@/components/FlashcardReview";
import { FeatureCard } from "@/components/FeatureCard";
import { StreakBadge } from "@/components/StreakBadge";
import { XPProgress } from "@/components/XPProgress";

const mockFlashcards = [
  {
    id: "1",
    word: "Cómo",
    translation: "How / What",
    pronunciation: "KOH-moh",
    ipa: "/ˈko.mo/",
    context: "¿Cómo te llamas?",
  },
  {
    id: "2",
    word: "llamas",
    translation: "are called",
    pronunciation: "YAH-mahs",
    ipa: "/ˈʎa.mas/",
    context: "¿Cómo te llamas?",
  },
  {
    id: "3",
    word: "gusto",
    translation: "pleasure",
    pronunciation: "GOOS-toh",
    ipa: "/ˈɡus.to/",
    context: "Mucho gusto",
  },
  {
    id: "4",
    word: "dónde",
    translation: "where",
    pronunciation: "DOHN-deh",
    ipa: "/ˈdon.de/",
    context: "¿De dónde eres?",
  },
];

const Index = () => {
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [activeSection, setActiveSection] = useState<"demo" | "features" | "flashcards">("demo");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 px-6 py-4">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Layers className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold gradient-text">Ligua Overlay</span>
          </div>
          <div className="flex items-center gap-4">
            <StreakBadge streak={7} showAnimation={false} />
            <Button
              variant="hero"
              size="lg"
              onClick={() => window.open("https://chromewebstore.google.com/", "_blank")}
            >
              <Chrome className="w-5 h-5" />
              Add to Chrome
            </Button>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 px-6 pt-12 pb-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 glass-panel px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-muted-foreground">
              Turn any movie into a language lesson
            </span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 leading-tight">
            Learn languages while
            <br />
            <span className="gradient-text">streaming your favorites</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            A Chrome extension that overlays Netflix, YouTube, and more with interactive subtitles,
            flashcards, and gamification—without pausing the fun.
          </p>

          {/* Navigation tabs */}
          <div className="flex justify-center gap-2 mb-8">
            {[
              { id: "demo", label: "Live Demo", icon: Play },
              { id: "features", label: "Features", icon: Zap },
              { id: "flashcards", label: "Flashcards", icon: BookOpen },
            ].map(({ id, label, icon: Icon }) => (
              <Button
                key={id}
                variant={activeSection === id ? "default" : "glass"}
                onClick={() => setActiveSection(id as typeof activeSection)}
                className="gap-2"
              >
                <Icon className="w-4 h-4" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Content Sections */}
      <section className="relative z-10 px-6 pb-20">
        <div className="max-w-7xl mx-auto">
          {activeSection === "demo" && (
            <div className="animate-fade-in">
              <div className="grid lg:grid-cols-[1fr,320px] gap-6">
                <VideoPlayer />
                <SettingsPanel className="hidden lg:block" />
              </div>
              <div className="lg:hidden mt-6">
                <SettingsPanel />
              </div>
            </div>
          )}

          {activeSection === "features" && (
            <div className="animate-fade-in">
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <FeatureCard
                  icon={Subtitles}
                  title="Interactive Subtitles"
                  description="Click any word to see translations, pronunciations, and save to flashcards. Dual subtitle mode shows both languages."
                  gradient="primary"
                />
                <FeatureCard
                  icon={BookOpen}
                  title="Smart Flashcards"
                  description="Spaced repetition system auto-generates cards from saved words. Review before or after watching."
                  gradient="success"
                />
                <FeatureCard
                  icon={Flame}
                  title="Daily Streaks"
                  description="Build habits with streak tracking. Watch 10+ minutes and interact with content to maintain your streak."
                  gradient="accent"
                />
                <FeatureCard
                  icon={Sparkles}
                  title="XP & Levels"
                  description="Earn XP from watching, clicking words, and reviewing flashcards. Level up with satisfying animations."
                  gradient="primary"
                />
                <FeatureCard
                  icon={Star}
                  title="AI Difficulty Rating"
                  description="Content is automatically rated 1-5 stars based on speech speed, vocabulary, and sentence complexity."
                  gradient="accent"
                />
                <FeatureCard
                  icon={Layers}
                  title="Works Everywhere"
                  description="Seamless overlay on Netflix, YouTube, Prime Video, Disney+, and any HTML5 video player."
                  gradient="success"
                />
              </div>

              {/* Stats section */}
              <div className="mt-12 glass-panel-strong p-8">
                <div className="grid md:grid-cols-4 gap-8 text-center">
                  <div>
                    <p className="text-4xl font-bold gradient-text">847</p>
                    <p className="text-muted-foreground mt-1">Words Learned</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold gradient-text-accent">42h</p>
                    <p className="text-muted-foreground mt-1">Watch Time</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold text-success">7</p>
                    <p className="text-muted-foreground mt-1">Day Streak</p>
                  </div>
                  <div>
                    <p className="text-4xl font-bold gradient-text">Level 12</p>
                    <p className="text-muted-foreground mt-1">Current Level</p>
                  </div>
                </div>
                <div className="mt-8 max-w-md mx-auto">
                  <XPProgress level={12} currentXP={2340} levelXP={3000} />
                </div>
              </div>
            </div>
          )}

          {activeSection === "flashcards" && (
            <div className="animate-fade-in">
              {showFlashcards ? (
                <FlashcardReview
                  cards={mockFlashcards}
                  onClose={() => setShowFlashcards(false)}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="glass-panel-strong inline-block p-8 max-w-md">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-success flex items-center justify-center mx-auto mb-6 shadow-glow-success">
                      <BookOpen className="w-8 h-8 text-success-foreground" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                      Ready for Review?
                    </h2>
                    <p className="text-muted-foreground mb-6">
                      You have {mockFlashcards.length} cards saved from your recent watching
                      sessions.
                    </p>
                    <Button
                      variant="hero"
                      size="lg"
                      onClick={() => setShowFlashcards(true)}
                    >
                      Start Review
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 py-16 border-t border-border">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Start learning while you watch
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of language learners who've discovered the joy of learning through
            entertainment.
          </p>
          <Button
            variant="hero"
            size="xl"
            onClick={() => window.open("https://chromewebstore.google.com/", "_blank")}
          >
            <Chrome className="w-5 h-5" />
            Add Ligua to Chrome — It's Free
          </Button>
          <p className="text-xs text-muted-foreground mt-4">
            Works with Netflix, YouTube, Prime Video, Disney+, and more
          </p>
        </div>
      </section>
    </div>
  );
};

export default Index;
