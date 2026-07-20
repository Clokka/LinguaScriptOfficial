import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Play,
  Languages,
  Sparkles,
  Subtitles,
  BookOpen,
  Flame,
  Star,
  Layers,
  Zap,
  MousePointerClick,
  ArrowRight,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProductDemoPlayer } from "@/components/ProductDemoPlayer";
import { LineBlastDemo } from "@/components/LineBlastDemo";

/**
 * LinguaScript Landing Page v2 — product-walkthrough style.
 * Inspired by the legacy LinguaOverlay layout but rebranded in current
 * LinguaScript tokens (indigo primary, amber accent, emerald success,
 * glass-panel surfaces, Framer Motion).
 *
 * NOTE: This page is mounted at /landingpage2. The original /landing route is
 * untouched.
 */
const LandingPage2 = () => {
  const navigate = useNavigate();

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i: number = 0) => ({
      opacity: 1,
      y: 0,
      transition: { delay: i * 0.08, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }),
  };

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* ─── Nav ─── */}
      <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/landingpage2")} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
              <Languages className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold gradient-text">LinguaScript</span>
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="text-muted-foreground hover:text-foreground">
              Sign In
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/onboarding")}
              className="bg-gradient-to-r from-primary to-[hsl(280,100%,60%)] text-primary-foreground"
            >
              Open App
            </Button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-48 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-primary/15 blur-[140px]" />
          <div className="absolute top-40 -right-40 w-[500px] h-[500px] rounded-full bg-accent/10 blur-[120px]" />
          <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-success/8 blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 glass-panel rounded-full px-4 py-1.5 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-semibold tracking-wide text-foreground">
              Turn any movie into a language lesson
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6"
          >
            <span className="text-foreground">Learn languages while</span>
            <br />
            <span className="bg-gradient-to-r from-primary via-[hsl(280,100%,65%)] to-accent bg-clip-text text-transparent">
              streaming your favorites
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed"
          >
            LinguaScript overlays YouTube and films with interactive dual subtitles, flashcards,
            and gamification — without pausing the fun.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-3 mb-16"
          >
            <Button
              size="lg"
              onClick={() => navigate("/story")}
              className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-[hsl(280,100%,60%)] text-primary-foreground gap-2 shadow-glow-primary"
            >
              <Play className="w-4 h-4 fill-current" />
              Live Demo
            </Button>
            <Button
              size="lg"
              variant="glass"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="h-12 px-6 rounded-xl gap-2"
            >
              <Zap className="w-4 h-4 text-accent" />
              Features
            </Button>
            <Button
              size="lg"
              variant="glass"
              onClick={() => document.getElementById("flashcards")?.scrollIntoView({ behavior: "smooth" })}
              className="h-12 px-6 rounded-xl gap-2"
            >
              <BookOpen className="w-4 h-4 text-primary" />
              Flashcards
            </Button>
          </motion.div>

          {/* Learning loop ribbon */}
          <LearningLoop />
        </div>
      </section>

      {/* ─── Mock player demo ─── */}
      <section className="relative max-w-5xl mx-auto px-6 pb-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          variants={fadeUp}
          className="glass-panel-strong rounded-3xl overflow-hidden border border-border/60 shadow-[0_40px_120px_-40px_hsl(var(--primary)/0.5)]"
        >
          <ProductDemoPlayer />
        </motion.div>
      </section>

      {/* ─── Features grid ─── */}
      <section id="features" className="relative py-20">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold mb-3">
              Everything you need to learn naturally
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-muted-foreground max-w-xl mx-auto">
              Six powerful systems work together so progress compounds every minute you watch.
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
                className={cn(
                  "glass-panel p-6 rounded-2xl border transition-all duration-500 hover:-translate-y-1.5 hover:scale-[1.02]",
                  f.border,
                )}
              >
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", f.iconBg)}>
                  <f.icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Flashcard Red/Orange/Green showcase ─── */}
      <section id="flashcards" className="relative py-24">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-16"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 glass-panel rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-semibold tracking-wide">The LinguaScript memory system</span>
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-bold mb-4">
              Watch words climb from <span className="text-rose-400">red</span> to{" "}
              <span className="text-amber-400">orange</span> to{" "}
              <span className="text-emerald-400">green</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-2xl mx-auto">
              Every word you save starts red. Review it once correctly and it warms to orange.
              Recall it confidently and it locks in as green — mastered for life.
            </motion.p>
          </motion.div>

          <StageProgression />
        </div>
      </section>

      {/* ─── Line Blast interactive demo ─── */}
      <section id="line-blast" className="relative py-24">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/5 to-transparent pointer-events-none" />
        <div className="relative max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-12"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 glass-panel rounded-full px-4 py-1.5 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-xs font-semibold tracking-wide">New · Line Blast</span>
            </motion.div>
            <motion.h2 variants={fadeUp} custom={1} className="text-3xl sm:text-5xl font-bold mb-4">
              Complete the line.{" "}
              <span className="text-amber-400">Feel the blast.</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-muted-foreground max-w-2xl mx-auto">
              When the last word of a subtitle turns green, the whole line erupts —
              combos build across lines and multiply your XP up to ×5. Try it: tap the
              white words below.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            className="glass-panel-strong rounded-3xl p-3 sm:p-5 border border-border/60 shadow-[0_40px_120px_-40px_rgba(52,211,153,0.35)]"
          >
            <LineBlastDemo />
          </motion.div>
        </div>
      </section>

      {/* ─── Stats / social proof ─── */}
      <section className="relative py-20">
        <div className="max-w-5xl mx-auto px-6">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            variants={fadeUp}
            className="glass-panel-strong rounded-3xl p-10 sm:p-14 border border-border/60"
          >
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              <Stat value="847" label="Words Learned" color="text-primary" />
              <Stat value="42h" label="Watch Time" color="text-accent" />
              <Stat value="7" label="Day Streak" color="text-orange-400" />
              <Stat value="Lvl 12" label="Current Level" color="text-emerald-400" />
            </div>
            <div className="mt-10 max-w-md mx-auto">
              <div className="flex items-baseline justify-between text-xs text-muted-foreground mb-2">
                <span className="font-semibold text-foreground">Level 12</span>
                <span className="tabular-nums">2,340 / 3,000 XP</span>
              </div>
              <div className="h-2 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: "78%" }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-primary via-[hsl(280,100%,60%)] to-accent"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="relative py-24">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full bg-primary/10 blur-[120px]" />
        </div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative max-w-3xl mx-auto px-6 text-center"
        >
          <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-5xl font-bold mb-4">
            Start learning while you watch
          </motion.h2>
          <motion.p variants={fadeUp} custom={1} className="text-muted-foreground mb-10 max-w-xl mx-auto text-lg">
            Join thousands of learners turning their watch time into vocabulary, sentence by sentence.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Button
              size="lg"
              onClick={() => navigate("/onboarding")}
              className="h-14 px-10 text-base rounded-full bg-gradient-to-r from-primary via-[hsl(280,100%,60%)] to-accent shadow-glow-primary gap-3 text-primary-foreground font-semibold"
            >
              <Play className="w-5 h-5 fill-current" />
              Open LinguaScript
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        </motion.div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LinguaScript. Learn languages by watching films.
        </div>
      </footer>
    </div>
  );
};

/* ── Learning loop ribbon ── */
const LOOP_STEPS = [
  { icon: Play, label: "Watch Content", color: "from-primary to-[hsl(280,100%,60%)]" },
  { icon: MousePointerClick, label: "Save Words", color: "from-accent to-[hsl(45,100%,60%)]" },
  { icon: BookOpen, label: "Review Flashcards", color: "from-success to-[hsl(160,70%,50%)]" },
  { icon: Sparkles, label: "Understand More", color: "from-primary to-accent" },
];

const LearningLoop = () => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.4, duration: 0.7 }}
    className="glass-panel rounded-2xl px-4 py-5 max-w-3xl mx-auto"
  >
    <div className="flex items-center justify-between gap-2 sm:gap-4 flex-wrap sm:flex-nowrap">
      {LOOP_STEPS.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shrink-0", s.color)}>
              <s.icon className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-[10px] sm:text-xs font-semibold text-foreground text-center whitespace-nowrap">{s.label}</span>
          </div>
          {i < LOOP_STEPS.length - 1 && (
            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  </motion.div>
);

/* ── Mock video player visual ── */
const SUB_LINES = [
  { fr: "Bonjour, comment ça va?", en: "Hello, how are you?" },
  { fr: "Très bien, merci.", en: "Very well, thank you." },
  { fr: "Tu viens au cinéma ce soir?", en: "Are you coming to the movies tonight?" },
];

const MockPlayer = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SUB_LINES.length), 3000);
    return () => clearInterval(id);
  }, []);
  const line = SUB_LINES[idx];

  return (
    <div className="relative aspect-video bg-gradient-to-br from-secondary via-background to-secondary/40 flex items-center justify-center">
      {/* fake play indicator */}
      <div className="w-20 h-20 rounded-full bg-primary/20 backdrop-blur-md flex items-center justify-center ring-1 ring-primary/30">
        <Play className="w-9 h-9 text-primary-foreground fill-current ml-1" />
      </div>

      {/* HUD streak badge */}
      <div className="absolute top-4 right-4 glass-panel px-3 py-1.5 rounded-full flex items-center gap-1.5">
        <Flame className="w-3.5 h-3.5 text-orange-400" />
        <span className="text-xs font-bold text-foreground">7 day streak</span>
      </div>

      {/* Subtitles */}
      <motion.div
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[min(90%,640px)] glass-panel-strong rounded-2xl px-6 py-4 text-center"
      >
        <p className="text-xl sm:text-2xl font-semibold text-foreground mb-1">
          {line.fr.split(" ").map((w, i) => (
            <span
              key={i}
              className={cn(
                "inline-block mx-0.5 px-1 rounded transition-colors cursor-pointer",
                i === 1 && "bg-primary/25 text-primary-foreground",
              )}
            >
              {w}
            </span>
          ))}
        </p>
        <p className="text-sm text-muted-foreground">{line.en}</p>
      </motion.div>

      {/* Control bar */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-3 bg-gradient-to-t from-black/70 to-transparent">
        <div className="h-1 rounded-full bg-white/15 overflow-hidden mb-2">
          <motion.div
            key={idx}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 3, ease: "linear" }}
            className="h-full bg-primary"
          />
        </div>
      </div>
    </div>
  );
};

/* ── Features list ── */
const FEATURES = [
  {
    icon: Subtitles,
    title: "Interactive Subtitles",
    description: "Click any word for instant translation, pronunciation, and flashcard save.",
    iconBg: "bg-gradient-primary shadow-glow-primary",
    border: "border-primary/30",
  },
  {
    icon: BookOpen,
    title: "Smart Flashcards",
    description: "Spaced-repetition cards auto-generate from every word you save while watching.",
    iconBg: "bg-gradient-success shadow-glow-success",
    border: "border-success/30",
  },
  {
    icon: Flame,
    title: "Daily Streaks",
    description: "Build habits with streak tracking. Watch and interact to keep your fire alive.",
    iconBg: "bg-gradient-accent shadow-glow-accent",
    border: "border-accent/30",
  },
  {
    icon: Sparkles,
    title: "XP & Levels",
    description: "Earn XP from watching, clicking words, and reviewing flashcards.",
    iconBg: "bg-gradient-primary shadow-glow-primary",
    border: "border-primary/30",
  },
  {
    icon: Star,
    title: "AI Difficulty Rating",
    description: "Every clip is auto-rated 1–5 stars based on speech speed and complexity.",
    iconBg: "bg-gradient-accent shadow-glow-accent",
    border: "border-accent/30",
  },
  {
    icon: Layers,
    title: "Dual Subtitles",
    description: "See the original language and your native translation side by side, in real time.",
    iconBg: "bg-gradient-success shadow-glow-success",
    border: "border-success/30",
  },
];

/* ── Red/Orange/Green flashcard showcase ── */
const STAGES = [
  {
    key: "red",
    label: "Red",
    title: "New Word",
    description: "You just saved it from a subtitle. Brain has zero anchor yet.",
    word: "papillon",
    translation: "butterfly",
    tint: "from-rose-500/20 to-rose-500/5",
    border: "border-rose-500/40",
    dot: "bg-rose-500",
    text: "text-rose-300",
  },
  {
    key: "orange",
    label: "Orange",
    title: "Learning",
    description: "One correct recall. The neural path is forming — momentum is here.",
    word: "papillon",
    translation: "butterfly",
    tint: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/40",
    dot: "bg-amber-400",
    text: "text-amber-300",
  },
  {
    key: "green",
    label: "Green",
    title: "Mastered",
    description: "Recalled confidently. Word is yours — surfaces effortlessly in context.",
    word: "papillon",
    translation: "butterfly",
    tint: "from-emerald-500/20 to-emerald-500/5",
    border: "border-emerald-500/40",
    dot: "bg-emerald-500",
    text: "text-emerald-300",
  },
];

const StageProgression = () => (
  <div className="relative">
    {/* progression line on desktop */}
    <div className="hidden md:block absolute top-20 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-rose-500/40 via-amber-500/40 to-emerald-500/40" />

    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
      {STAGES.map((s, i) => (
        <motion.div
          key={s.key}
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "glass-panel rounded-2xl p-6 border bg-gradient-to-br relative",
            s.tint,
            s.border,
          )}
        >
          <div className="flex items-center gap-2 mb-4">
            <span className={cn("w-3 h-3 rounded-full ring-4 ring-background", s.dot)} />
            <span className={cn("text-xs font-bold uppercase tracking-wider", s.text)}>
              {s.label}
            </span>
            <span className="ml-auto text-xs text-muted-foreground">Stage {i + 1}</span>
          </div>

          {/* Flashcard mock */}
          <div className={cn("rounded-xl p-5 mb-4 bg-background/40 border", s.border)}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">French</p>
            <p className="text-2xl font-bold text-foreground mb-3">{s.word}</p>
            <div className="h-px bg-border my-3" />
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">English</p>
            <p className={cn("text-lg font-semibold", i === 0 ? "blur-sm select-none" : s.text)}>
              {s.translation}
            </p>
          </div>

          <h3 className="text-lg font-bold text-foreground mb-1">{s.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>

          {/* progress dots */}
          <div className="mt-5 flex items-center gap-1.5">
            {[0, 1, 2].map((d) => (
              <span
                key={d}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  d <= i ? cn(s.dot, "w-8") : "bg-secondary w-3",
                )}
              />
            ))}
            {i === 2 && <Check className={cn("w-4 h-4 ml-1", s.text)} />}
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

const Stat = ({ value, label, color }: { value: string; label: string; color: string }) => (
  <div>
    <p className={cn("text-4xl sm:text-5xl font-extrabold tabular-nums mb-1", color)}>{value}</p>
    <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
  </div>
);

export default LandingPage2;
