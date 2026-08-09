import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Check,
  Sparkles,
  GraduationCap,
  Eye,
  Layers,
  Repeat,
  ArrowRight,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    icon: Eye,
    title: "1. Watch what you already love",
    body:
      "Paste any YouTube video. LinguaScript adds dual subtitles in your target language and your own — no dubbed textbook dialogue.",
  },
  {
    icon: Layers,
    title: "2. Tap the words you don't know",
    body:
      "Every tap saves a flashcard with the sentence it came from, so the meaning sticks to a real moment instead of a list.",
  },
  {
    icon: Repeat,
    title: "3. Turn the language green",
    body:
      "Words move red → orange → green as you review. Your subtitles visibly dim as your comprehension climbs.",
  },
  {
    icon: Sparkles,
    title: "4. Rewatch and measure",
    body:
      "Watch the same video again and see your understanding jump — 42% to 68% — with a score you can actually track.",
  },
];

const PLANS = [
  {
    name: "Monthly",
    price: "£6.99",
    period: "/ month",
    note: "Cancel anytime",
  },
  {
    name: "Yearly",
    price: "£49",
    period: "/ year",
    note: "Best value — two months free",
    highlight: true,
  },
  {
    name: "Lifetime",
    price: "£99",
    period: "once",
    note: "Yours forever",
  },
];

const PRO_FEATURES = [
  "Unlimited learning languages",
  "Unlimited flashcards and reviews",
  "Priority AI translations",
  "Comprehension tracking on every video",
  "Every new feature, first",
];

export default function ChameleonMethod() {
  const navigate = useNavigate();
  const [requested, setRequested] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-16 space-y-20">
        {/* Hero */}
        <motion.header
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-4"
        >
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
            <Sparkles className="w-3 h-3" /> The Chameleon Method
          </span>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground leading-tight">
            Learn a language the way you already watch
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            The Chameleon Method turns real video into a comprehension engine. Four steps,
            no grammar drills, and a score that proves you're improving.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button variant="hero" size="lg" className="gap-2" onClick={() => navigate("/onboarding")}>
              Start onboarding <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.header>

        {/* Method steps */}
        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-foreground text-center">How it works</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {STEPS.map((s) => (
              <div key={s.title} className="glass-panel p-5 space-y-2">
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                  <s.icon className="w-4 h-4 text-primary" />
                </div>
                <h3 className="text-foreground font-medium">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Student account */}
        <section className="glass-panel-strong p-7 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-success/15 border border-success/30 flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-success" />
          </div>
          <h2 className="text-2xl font-semibold text-foreground">
            Students get Pro for free
          </h2>
          <p className="text-muted-foreground text-sm max-w-md mx-auto">
            If you're studying a language at school, college or university, request a student
            account and we'll unlock LinguaScript Pro at no cost.
          </p>
          {requested ? (
            <p className="text-success text-sm">
              Thanks — your request is on its way. We'll email your Pro link shortly.
            </p>
          ) : (
            <Button
              variant="hero"
              size="lg"
              className="gap-2"
              onClick={() => {
                setRequested(true);
                window.location.href =
                  "mailto:hello@linguascript.co.uk?subject=Student%20Pro%20request&body=Hi%20LinguaScript%2C%0A%0AI%27d%20like%20a%20free%20student%20Pro%20account.%0A%0ASchool%2Fcollege%3A%0ALanguage%20I%27m%20studying%3A%0AAccount%20email%3A%0A";
              }}
            >
              <GraduationCap className="w-4 h-4" /> Request a student account
            </Button>
          )}
        </section>

        {/* Plans */}
        <section className="space-y-5">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Or go Pro</h2>
            <p className="text-muted-foreground text-sm">
              Everything in the method, without limits.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className={`glass-panel p-5 text-center space-y-2 ${
                  p.highlight ? "border-primary/50 ring-1 ring-primary/30" : ""
                }`}
              >
                {p.highlight && (
                  <span className="inline-block text-[10px] uppercase tracking-wider text-primary">
                    Most popular
                  </span>
                )}
                <p className="text-foreground font-medium">{p.name}</p>
                <p className="text-3xl font-bold text-foreground">
                  {p.price}
                  <span className="text-sm font-normal text-muted-foreground"> {p.period}</span>
                </p>
                <p className="text-xs text-muted-foreground">{p.note}</p>
              </div>
            ))}
          </div>

          <div className="glass-panel p-5">
            <ul className="grid sm:grid-cols-2 gap-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="w-4 h-4 text-success shrink-0 mt-0.5" /> {f}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button variant="hero" size="lg" className="gap-2 w-full sm:w-auto" onClick={() => navigate("/pricing")}>
              <Crown className="w-4 h-4" /> See Pro plans
            </Button>
            <button
              type="button"
              onClick={() => navigate("/onboarding")}
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors"
            >
              Continue with basic plan
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
