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
  Mail,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const Landing = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filmCount, setFilmCount] = useState(0);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    supabase
      .from("films")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        if (count !== null) setFilmCount(count);
      });
  }, []);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("email_signups").insert({ email: email.trim().toLowerCase() });
    if (error) {
      if (error.code === "23505") {
        toast({ title: "You're already on the list! 🎉" });
        setSubmitted(true);
      } else {
        toast({ title: "Something went wrong", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "You're in! 🚀", description: "We'll notify you when LinguaScript launches." });
      setSubmitted(true);
    }
    setSubmitting(false);
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }),
  };

  const steps = [
    {
      icon: Film,
      title: "Pick a Film",
      description: "Paste any YouTube URL and LinguaScript fetches subtitles automatically.",
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
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
            <Button size="sm" onClick={() => navigate("/browse")} className="bg-gradient-to-r from-primary to-[hsl(280,100%,60%)] text-primary-foreground">
              Open App
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
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

          {/* Email Capture */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="max-w-lg mx-auto mb-6"
          >
            {submitted ? (
              <div className="flex items-center justify-center gap-3 h-14 rounded-full bg-success/10 border border-success/30 px-6">
                <Check className="w-5 h-5 text-success" />
                <span className="text-success font-medium">You're on the list! We'll be in touch.</span>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    type="email"
                    placeholder="Enter your email for early access..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-14 pl-12 pr-4 rounded-full bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground text-base"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-14 px-8 rounded-full bg-gradient-to-r from-primary via-[hsl(280,100%,60%)] to-accent shadow-glow-primary hover:shadow-glow-accent transition-all duration-500 hover:scale-105 text-primary-foreground font-semibold whitespace-nowrap"
                >
                  {submitting ? "..." : "Notify Me"}
                </Button>
              </form>
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Be first to know when LinguaScript officially launches. No spam, ever.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-6 text-sm text-muted-foreground"
          >
            <Button
              variant="ghost"
              onClick={() => navigate("/story")}
              className="gap-2 text-primary hover:text-primary"
            >
              <Play className="w-4 h-4" />
              Try the Demo
              <ArrowRight className="w-4 h-4" />
            </Button>
            {filmCount > 0 && (
              <span>
                <span className="text-accent font-bold">{filmCount}</span> films available
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
            Ready to Start Learning?
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground mb-10 max-w-xl mx-auto text-lg">
            Paste any YouTube link, get interactive subtitles instantly.
          </motion.p>
          <motion.div variants={fadeUp} custom={2} className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => navigate("/story")}
              className="h-14 px-10 text-lg rounded-full bg-gradient-to-r from-accent to-[hsl(45,100%,60%)] shadow-glow-accent hover:shadow-glow-primary transition-all duration-500 hover:scale-105 gap-3 text-accent-foreground font-semibold"
            >
              <Play className="w-5 h-5" />
              Open LinguaScript
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LinguaScript. Learn languages by watching films.
        </div>
      </footer>
    </div>
  );
};

export default Landing;
