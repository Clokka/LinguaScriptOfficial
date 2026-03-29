import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Play,
  Languages,
  Mic,
  BookOpen,
  Sparkles,
  Subtitles,
  Film,
  ArrowRight,
  MousePointerClick,
  Eye,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { NavBar } from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

const Landing = () => {
  const navigate = useNavigate();
  const [filmCount, setFilmCount] = useState(0);

  useEffect(() => {
    supabase
      .from("films")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count !== null) setFilmCount(count);
      });
  }, []);

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    }),
  };

  const steps = [
    {
      icon: Film,
      title: "Pick a Film",
      description: "Browse our catalog of YouTube videos and films in your target language.",
      color: "from-primary to-[hsl(280,100%,60%)]",
      glow: "shadow-glow-primary",
    },
    {
      icon: Eye,
      title: "Watch & Read",
      description: "Dual subtitles show the original language and your native translation simultaneously.",
      color: "from-accent to-[hsl(45,100%,60%)]",
      glow: "shadow-glow-accent",
    },
    {
      icon: MousePointerClick,
      title: "Learn Words",
      description: "Click any word for instant pronunciation, translation, and flashcard creation.",
      color: "from-success to-[hsl(160,70%,50%)]",
      glow: "shadow-glow-success",
    },
  ];

  const features = [
    {
      icon: Subtitles,
      title: "Dual Subtitles",
      description: "See the original language and your translation side by side in real time.",
      gradient: "from-primary/20 to-primary/5",
      border: "border-primary/30",
      iconBg: "bg-gradient-primary shadow-glow-primary",
    },
    {
      icon: Mic,
      title: "Pronunciation",
      description: "Hear any word spoken aloud in the correct accent with one click.",
      gradient: "from-accent/20 to-accent/5",
      border: "border-accent/30",
      iconBg: "bg-gradient-accent shadow-glow-accent",
    },
    {
      icon: BookOpen,
      title: "Flashcards",
      description: "Save words and review them later with spaced-repetition flashcards.",
      gradient: "from-success/20 to-success/5",
      border: "border-success/30",
      iconBg: "bg-gradient-success shadow-glow-success",
    },
  ];

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Languages className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">LinguaScript</span>
          </button>
          <NavBar />
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        {/* Animated background blobs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] animate-pulse" />
          <div className="absolute top-20 -right-40 w-[500px] h-[500px] rounded-full bg-accent/8 blur-[100px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute -bottom-20 left-1/3 w-[400px] h-[400px] rounded-full bg-success/6 blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative max-w-5xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-full px-5 py-2 mb-8"
          >
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-sm text-primary font-semibold tracking-wide">Early Access</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1]"
          >
            <span className="text-foreground">Learn Languages</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-accent to-success bg-clip-text text-transparent">
              By Watching Films
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed"
          >
            LinguaScript overlays interactive subtitles on real films and videos.
            Click any word to hear pronunciation, see translations, and build vocabulary — naturally.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Button
              size="lg"
              onClick={() => navigate("/browse")}
              className="h-14 px-10 text-lg rounded-full bg-gradient-to-r from-primary via-[hsl(280,100%,60%)] to-accent shadow-glow-primary hover:shadow-glow-accent transition-all duration-500 hover:scale-105 gap-3 text-primary-foreground font-semibold"
            >
              <Play className="w-5 h-5" />
              Learn with LinguaScript
              <ArrowRight className="w-5 h-5" />
            </Button>
            {filmCount > 0 && (
              <span className="text-sm text-muted-foreground">
                <span className="text-accent font-bold">{filmCount}</span> films available now
              </span>
            )}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="relative max-w-5xl mx-auto px-6 py-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-4 py-1.5 mb-4">
            <Sparkles className="w-4 h-4 text-accent" />
            <span className="text-sm text-accent font-medium">How It Works</span>
          </motion.div>
          <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold text-foreground mb-3">
            Three simple steps to start learning
          </motion.h2>
          <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-lg mx-auto">
            Start learning with real content in minutes
          </motion.p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <motion.div
              key={step.title}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i + 1}
              className="relative group"
            >
              <div className="glass-panel p-8 rounded-2xl h-full transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2 border border-border hover:border-primary/30">
                {/* Step number */}
                <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} ${step.glow} flex items-center justify-center mb-6 transition-transform duration-500 group-hover:rotate-6`}>
                  <span className="text-xl font-bold text-primary-foreground">{i + 1}</span>
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/3 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 bg-success/10 border border-success/20 rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-4 h-4 text-success" />
              <span className="text-sm text-success font-medium">Features</span>
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-4xl font-bold text-foreground">
              Everything you need to learn naturally
            </motion.h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i + 1}
                className="group"
              >
                <div className={`glass-panel p-8 rounded-2xl h-full bg-gradient-to-br ${feature.gradient} border ${feature.border} transition-all duration-500 hover:scale-[1.03] hover:-translate-y-2`}>
                  <div className={`w-14 h-14 rounded-2xl ${feature.iconBg} flex items-center justify-center mb-6 transition-transform duration-500 group-hover:scale-110`}>
                    <feature.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/8 blur-[120px]" />
        </div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative max-w-3xl mx-auto px-6 text-center"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Ready to Start?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground mb-10 max-w-xl mx-auto text-lg">
            Jump in and explore our growing catalog of language-learning content.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Button
              size="lg"
              onClick={() => navigate("/browse")}
              className="h-14 px-10 text-lg rounded-full bg-gradient-to-r from-accent to-[hsl(45,100%,60%)] shadow-glow-accent hover:shadow-glow-primary transition-all duration-500 hover:scale-105 gap-3 text-accent-foreground font-semibold"
            >
              Browse Catalog
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
          {filmCount > 0 && (
            <motion.p variants={fadeUp} custom={3} className="text-sm text-muted-foreground mt-6">
              🎬 {filmCount} film{filmCount !== 1 ? "s" : ""} and growing
            </motion.p>
          )}
        </motion.div>
      </section>
    </div>
  );
};

export default Landing;
