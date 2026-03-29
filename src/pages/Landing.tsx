import { useNavigate } from "react-router-dom";
import { Play, Languages, Mic, BookOpen, Zap, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureCard } from "@/components/FeatureCard";

const Landing = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="relative max-w-5xl mx-auto px-6 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-8">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm text-primary font-medium">Early Access</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
            <span className="gradient-text">Learn Languages</span>
            <br />
            <span className="text-foreground">By Watching Films</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            LinguaScript overlays interactive subtitles on real films and videos.
            Click any word to hear pronunciation, see translations, and build vocabulary — naturally.
          </p>

          <Button
            size="lg"
            onClick={() => navigate("/browse")}
            className="h-14 px-8 text-lg rounded-full bg-gradient-primary shadow-glow-primary hover:opacity-90 transition-opacity gap-3"
          >
            <Play className="w-5 h-5" />
            Learn with LinguaScript
            <ArrowRight className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-foreground mb-4">How It Works</h2>
        <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
          Three simple steps to start learning with real content
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: "1", title: "Pick a Film", desc: "Browse our catalog of YouTube videos and films in your target language." },
            { step: "2", title: "Watch & Read", desc: "Dual subtitles show the original language and your native translation simultaneously." },
            { step: "3", title: "Learn Words", desc: "Click any word for instant pronunciation, translation, and flashcard creation." },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-primary">{item.step}</span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center text-foreground mb-12">Features</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard icon={Languages} title="Dual Subtitles" description="See the original language and your translation side by side in real time." gradient="primary" />
          <FeatureCard icon={Mic} title="Pronunciation" description="Hear any word spoken aloud in the correct accent with one click." gradient="accent" />
          <FeatureCard icon={BookOpen} title="Flashcards" description="Save words and review them later with spaced-repetition flashcards." gradient="success" />
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-bold text-foreground mb-4">Ready to Start?</h2>
        <p className="text-muted-foreground mb-8">Jump in and explore our growing catalog of language-learning content.</p>
        <Button
          size="lg"
          onClick={() => navigate("/browse")}
          className="h-12 px-8 rounded-full bg-gradient-primary shadow-glow-primary hover:opacity-90 transition-opacity gap-2"
        >
          Browse Catalog
          <ArrowRight className="w-4 h-4" />
        </Button>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center">
        <p className="text-xs text-muted-foreground">
          LinguaScript is in early access — more content coming soon
        </p>
      </footer>
    </div>
  );
};

export default Landing;
