import { trackAll } from "@/lib/experiments";
import { track, setPerson } from "@/lib/analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/i18n";
import { UiLanguageSwitcher } from "@/components/UiLanguageSwitcher";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { useAuth } from "@/hooks/useAuth";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, PENDING_LANGUAGE_KEY } from "@/contexts/LanguageContext";
import { playDing } from "@/lib/sound";
import { toast } from "sonner";
import { DEFAULT_WORD_GOAL, videoGoalForWords } from "@/lib/progressStats";
import { INTERESTS } from "@/lib/interests";
import { addLanguageProfile, type LearningMode } from "@/lib/languageProfiles";
import { rememberGuestOnboarding, applyGuestOnboarding } from "@/lib/guestOnboarding";

// "beginner" is a true zero-knowledge start — not a CEFR level, a signal
// that nothing should be pre-marked as already known. See addLanguageProfile's
// totalBeginner path. Learners only ever see two plain choices; "A2" is the
// "I know a bit" start. Fine-grained CEFR lives in Profile for those who care.
type Level = "beginner" | "A2";

const CHROME_STORE_URL = "https://chromewebstore.google.com/search/linguascript";

// Three short screens: language → hobby → how it works (+ get the extension).
// No CEFR grid, daily goal, school, written goal, leaderboard or demo video —
// each one was a decision a brand-new learner can't make yet. Defaults are
// sensible and every one of them is still editable in Profile.
const Onboarding = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { setLearningLanguage } = useLanguage();
  const [saving, setSaving] = useState(false);
  const { t } = useT();

  // Persist progress so a refresh resumes exactly here. (v2: v1 had 4 steps.)
  const ONBOARDING_KEY = "ls.onboardingState.v2";
  const initialPersisted = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(ONBOARDING_KEY) : null;
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();
  const browserLang = (() => {
    try {
      const code = (navigator.language || "en").slice(0, 2).toLowerCase();
      return LANGUAGES.some((l) => l.code === code) ? code : "en";
    } catch { return "en"; }
  })();

  const [step, setStep] = useState<number>(initialPersisted?.step ?? 0);
  const [native, setNative] = useState<string>(initialPersisted?.native ?? browserLang);
  const [target, setTarget] = useState<string>(initialPersisted?.target ?? "");
  const [level, setLevel] = useState<Level>(initialPersisted?.level === "A2" ? "A2" : "beginner");
  const [interests, setInterests] = useState<string[]>((initialPersisted?.interests ?? []).slice(0, 1));
  const mode: LearningMode = "fluency";
  const wordGoal = DEFAULT_WORD_GOAL;

  useEffect(() => {
    try {
      localStorage.setItem(ONBOARDING_KEY, JSON.stringify({ step, native, target, level, interests }));
    } catch { /* ignore */ }
  }, [step, native, target, level, interests]);

  // Already-onboarded learners skip straight to the app.
  const profileLoaded = useRef(false);
  useEffect(() => {
    if (!user || profileLoaded.current) return;
    profileLoaded.current = true;
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle().then(async ({ data }) => {
      if ((data as any)?.onboarded || await applyGuestOnboarding(user.id)) {
        try { localStorage.removeItem(ONBOARDING_KEY); localStorage.removeItem("ls.onboardingState.v1"); } catch { /* ignore */ }
        navigate("/discover", { replace: true });
        return;
      }
      if (data && !initialPersisted) {
        if (data.native_language) setNative(data.native_language);
        if (Array.isArray((data as any).interests) && (data as any).interests.length) {
          setInterests((data as any).interests.slice(0, 1));
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSteps = 3;

  const canContinue = useMemo(() => {
    if (step === 0) return !!native && !!target && native !== target;
    if (step === 1) return interests.length === 1;
    return true;
  }, [step, native, target, interests]);

  const rememberGuest = () =>
    rememberGuestOnboarding({ native, target, level, mode, school: "", wordGoal, goal: "", interests, showOnLeaderboard: true });

  // Saving runs in the background so the screen never sits frozen on a slow
  // network; `saving` only locks the button against double taps.
  const next = async () => {
    if (saving) return;
    if (step === 0) {
      try { localStorage.setItem(PENDING_LANGUAGE_KEY, target); } catch { /* ignore */ }
      if (user) {
        const isTotalBeginner = level === "beginner";
        const storedLevel = isTotalBeginner ? "a1" : level;
        setLearningLanguage(target);
        void (async () => {
          const { error } = await supabase.from("profiles").update({
            native_language: native,
            learning_language: target,
            cef_level: storedLevel,
            daily_word_goal: wordGoal,
            daily_video_goal: videoGoalForWords(wordGoal),
          } as any).eq("user_id", user.id);
          if (error) toast.error(t("saveFailed"));
          try {
            await addLanguageProfile({ userId: user.id, language: target, mode, level: storedLevel, totalBeginner: isTotalBeginner });
          } catch { /* seeding retried from Profile; never block onboarding */ }
        })();
      }
    }
    if (step === 1 && user) {
      void supabase.from("profiles").update({ interests } as any).eq("user_id", user.id);
    }
    if (step < totalSteps - 1) {
      track("onboarding_step_completed", { step });
      setStep((s) => s + 1);
      return;
    }
    await finish();
  };

  const finish = async (to = "/discover") => {
    setSaving(true);
    const interest = String(interests?.[0] ?? "none");
    if (user) {
      await supabase.from("profiles").update({ onboarded: true, interests } as any).eq("user_id", user.id);
      trackAll("signup", { interest, goal: "none" });
      track("onboarding_completed", { interest, interests_count: interests.length });
      setPerson({ interest });
    } else {
      rememberGuest();
      track("onboarding_completed", { guest: true, interest });
    }
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* ignore */ }
    playDing("success");
    setSaving(false);
    navigate(to);
  };

  const addToChrome = () => {
    track("extension_install_clicked", { from: "onboarding" });
    window.open(CHROME_STORE_URL, "_blank", "noopener,noreferrer");
    void finish();
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  return (
    <div className="min-h-screen bg-[#0b1215] text-white antialiased">
      <header className="sticky top-0 z-50 bg-[#0b1215]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3"><BrandMark size={28} /><UiLanguageSwitcher /></div>
          <div className="flex items-center gap-2">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i === step ? "w-6 bg-[#34C759]" : i < step ? "w-2 bg-[#34C759]/60" : "w-2 bg-white/15"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 pt-10 pb-28 sm:pt-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 0 && (
              <Card>
                <Title>What do you want to learn?</Title>

                <div className="mt-8 space-y-6">
                  <LearningLanguageSelect
                    value={target}
                    onChange={(v) => {
                      setTarget(v);
                      if (v === native) setNative("");
                    }}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    {([["beginner", "🌱 Starting from zero"], ["A2", "🌿 I know a bit"]] as const).map(([l, label]) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setLevel(l)}
                        className={`rounded-xl border px-3 h-11 text-sm font-medium transition ${
                          level === l
                            ? "bg-[#34C759]/15 border-[#34C759] text-white"
                            : "bg-white/[0.02] border-white/10 text-white/75 hover:border-[#34C759]/60"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <Field label={t("iSpeak")}>
                    <LangSelect
                      value={native}
                      onChange={(v) => {
                        setNative(v);
                        if (v === target) setTarget("");
                      }}
                    />
                  </Field>
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <Title>What do you love watching?</Title>
                <Sub>We'll find videos about it.</Sub>

                <div className="mt-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {INTERESTS.map((interest) => {
                    const active = interests.includes(interest.id);
                    return (
                      <Button
                        key={interest.id}
                        type="button"
                        variant="outline"
                        aria-pressed={active}
                        onClick={() => setInterests([interest.id])}
                        className={`relative rounded-2xl border p-4 flex flex-col items-center justify-center gap-2 transition text-center min-h-[104px] ${
                          active
                            ? "bg-[#34C759] border-[#34C759] text-white shadow-[0_10px_24px_-10px_rgba(52,199,89,0.7)] scale-[1.02]"
                            : "bg-white/[0.02] border-white/10 text-white/90 hover:border-[#34C759]/60 hover:-translate-y-0.5"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#0b1215] text-[#34C759] flex items-center justify-center">
                            <Check className="w-3.5 h-3.5" strokeWidth={3} />
                          </span>
                        )}
                        <span className="text-3xl leading-none">{interest.emoji}</span>
                        <span className="text-sm font-medium">{interest.label}</span>
                      </Button>
                    );
                  })}
                </div>
              </Card>
            )}

            {step === 2 && (
              <HeroCard emoji="🦎" title="How it works">
                <ol className="mt-8 space-y-3 text-left max-w-sm mx-auto">
                  {[
                    ["🎬", "Watch YouTube or Netflix"],
                    ["👆", "Tap any word you don't know"],
                    ["🃏", "It's saved as a flashcard"],
                  ].map(([emoji, text]) => (
                    <li key={text} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-5 py-4">
                      <span className="text-2xl leading-none">{emoji}</span>
                      <span className="text-[15px] font-medium text-white">{text}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-8 flex flex-col items-center gap-3">
                  <Button
                    onClick={addToChrome}
                    disabled={saving}
                    className="h-12 px-8 rounded-full bg-[#34C759] hover:bg-[#2CB350] text-white font-bold shadow-[0_8px_24px_-8px_rgba(52,199,89,0.6)] gap-2"
                  >
                    Add to Chrome — free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <button
                    type="button"
                    onClick={() => finish()}
                    disabled={saving}
                    className="text-sm text-white/60 hover:text-white underline-offset-4 hover:underline"
                  >
                    {saving ? t("saving") : "Skip — start on the website"}
                  </button>
                </div>
              </HeroCard>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav controls — the last screen has its own two buttons. */}
        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0}
            className="rounded-full text-white/60 hover:text-white hover:bg-white/[0.04]"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("back")}
          </Button>
          {step < totalSteps - 1 && (
            <Button
              onClick={next}
              disabled={!canContinue || saving}
              className="h-12 px-7 rounded-2xl bg-[#34C759] hover:bg-[#2CB350] text-white font-bold shadow-[0_8px_24px_-8px_rgba(52,199,89,0.5)] gap-2 disabled:opacity-40"
            >
              {t("next")}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-3xl bg-white/[0.015] border border-white/10 p-7 sm:p-10">
    {children}
  </div>
);

// The single-focus, non-form moment — same idiom as the mobile app's own
// intro tour (mobile/app/tour.tsx): one giant hero glyph, one bold line, one
// line of body copy. Everything else in this flow still needs real inputs
// and keeps the card layout; this is the one step that's pure "look at this."
const HeroCard = ({
  emoji, title, body, children,
}: { emoji: string; title: string; body?: string; children?: React.ReactNode }) => (
  <div className="rounded-3xl bg-white/[0.015] border border-white/10 p-8 sm:p-12 text-center">
    <div className="text-7xl sm:text-8xl leading-none mb-6">{emoji}</div>
    <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-[-0.02em] leading-[1.1] text-white">
      {title}
    </h1>
    {body && <p className="mt-3 text-[15px] sm:text-base text-white/60 leading-relaxed max-w-md mx-auto">{body}</p>}
    {children}
  </div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-[26px] sm:text-[34px] font-semibold tracking-[-0.02em] leading-[1.15] text-white">
    {children}
  </h1>
);

const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[15px] sm:text-base text-white/50 leading-relaxed font-light">{children}</p>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-sm font-medium text-white/75 mb-2 block">{label}</label>
    {children}
  </div>
);

const POPULAR_LANGS = ["en", "es", "fr", "de", "it"];

const LangSelect = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) => {
  const filtered = LANGUAGES.filter((l) => l.code !== exclude);
  const popular = filtered.filter((l) => POPULAR_LANGS.includes(l.code));
  const rest = filtered.filter((l) => !POPULAR_LANGS.includes(l.code));

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="rounded-xl border-white/10 bg-white/[0.02] h-11 text-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#0E0E11] text-white">
        {popular.map((l) => (
          <SelectItem key={l.code} value={l.code}>
            <span className="flex items-center gap-2"><span>{l.flag}</span> {l.label}</span>
          </SelectItem>
        ))}
        {rest.length > 0 && (
          <>
            <SelectSeparator />
            {rest.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                <span className="flex items-center gap-2"><span>{l.flag}</span> {l.label}</span>
              </SelectItem>
            ))}
          </>
        )}
      </SelectContent>
    </Select>
  );
};

const AVAILABLE_LEARNING_LANGS = [
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "th", label: "Thai", flag: "🇹🇭" },
  { code: "en", label: "English", flag: "🇬🇧" },
];

const LearningLanguageSelect = ({
  value, onChange, exclude,
}: { value: string; onChange: (v: string) => void; exclude?: string }) => {
  const options = AVAILABLE_LEARNING_LANGS.filter((l) => l.code !== exclude);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {options.map((l) => {
        const active = value === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange(l.code)}
            className={`flex items-center gap-2 rounded-xl border px-3 h-11 text-sm font-medium transition ${
              active
                ? "bg-[#34C759] border-[#34C759] text-white shadow-[0_6px_18px_-6px_rgba(52,199,89,0.6)]"
                : "bg-white/[0.02] border-white/10 text-white/75 hover:border-[#34C759]/60"
            }`}
          >
            <span className="text-lg leading-none">{l.flag}</span>
            <span>{l.label}</span>
            {active && <Check className="w-4 h-4 ml-auto" />}
          </button>
        );
      })}
    </div>
  );
};

export default Onboarding;
