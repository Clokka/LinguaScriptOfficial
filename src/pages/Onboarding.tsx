import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Check, Sparkles, Languages, Subtitles,
  BookOpen, Brain, Mic, MousePointer2, Trophy, Flame,
  Headphones, MessageCircle, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
// (InteractiveDemo replaced by the live tour overlay launched from this screen)
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTour } from "@/contexts/TourContext";
import { TOUR_TRAINING_YT_ID } from "@/lib/tourSteps";
import { playDing } from "@/lib/sound";
import { toast } from "sonner";
import { DailyGoalPicker } from "@/components/DailyGoalPicker";
import { wordGoalForVideos } from "@/lib/progressStats";

const LEVELS = ["below", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = typeof LEVELS[number];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setLearningLanguage } = useLanguage();
  const { start: startTour } = useTour();
  const [enteringDemo, setEnteringDemo] = useState(false);

  const [step, setStep] = useState(0);
  const [native, setNative] = useState("en");
  const [target] = useState("fr"); // French-only — other languages "Coming soon"
  const [level, setLevel] = useState<Level | null>(null);
  const [school, setSchool] = useState("");
  const [videoGoal, setVideoGoal] = useState<number>(1);
  const [goal, setGoal] = useState("");
  const [goalSaved, setGoalSaved] = useState(false);
  const [dualClicked, setDualClicked] = useState(false);

  // Load any existing profile values (auth optional — anonymous users see onboarding too)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        if (data.native_language) setNative(data.native_language);
        if ((data as any).cef_level) setLevel((data as any).cef_level as Level);
        if ((data as any).learning_goal) setGoal((data as any).learning_goal);
        if ((data as any).school) setSchool((data as any).school);
        if ((data as any).daily_video_goal) setVideoGoal((data as any).daily_video_goal);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSteps = 7;

  const canContinue = useMemo(() => {
    if (step === 0) return true; // 3-pillars intro
    if (step === 1) return !!native && !!target && native !== target && !!level && level !== "below";
    if (step === 2) return goalSaved;
    if (step === 3) return dualClicked;
    return true;
  }, [step, native, target, level, goalSaved, dualClicked]);

  const next = async () => {
    if (step === 1 && user) {
      await supabase.from("profiles").update({
        native_language: native,
        learning_language: target,
        cef_level: level,
        school: school.trim() || null,
        daily_video_goal: videoGoal,
        daily_word_goal: wordGoalForVideos(videoGoal),
      } as any).eq("user_id", user.id);
      setLearningLanguage(target);
    }
    if (step < totalSteps - 1) {
      setStep((s) => s + 1);
    } else {
      // finish
      if (user) {
        await supabase.from("profiles").update({
          onboarded: true,
          learning_goal: goal || null,
        }).eq("user_id", user.id);
      }
      playDing("success");
      navigate("/browse");
    }
  };

  const back = () => setStep((s) => Math.max(0, s - 1));

  const saveGoal = async () => {
    if (!goal.trim() || !user) return;
    await supabase.from("profiles").update({ learning_goal: goal.trim() }).eq("user_id", user.id);
    setGoalSaved(true);
    playDing("success");
    toast.success("Goal saved");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/40 via-white to-white text-neutral-900 antialiased">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-orange-100/60">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center">
              <Languages className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-semibold tracking-tight">LinguaScript</span>
          </div>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? "w-6 bg-orange-500" : i < step ? "w-1.5 bg-orange-300" : "w-1.5 bg-orange-100"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 sm:py-16">
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
                <Eyebrow icon={<Sparkles className="w-3.5 h-3.5" />}>How fluency works</Eyebrow>
                <Title>The 3 pillars of language learning.</Title>
                <Sub>Every fluent speaker balances these three. LinguaScript is built around them.</Sub>

                <div className="mt-8 space-y-4">
                  <PillarCard
                    icon={<Headphones className="w-5 h-5" />}
                    pillar="Input"
                    aliases="Comprehension · Immersion"
                    title="Soak it in"
                    body="Videos, podcasts, books, real conversations. Linguascript turns YouTube into your daily input feed."
                  />
                  <PillarCard
                    icon={<MessageCircle className="w-5 h-5" />}
                    pillar="Output"
                    aliases="Fluency · Interaction · Practice"
                    title="Use the language"
                    body="Speaking, journaling, shadowing, exchanges. Click any subtitle word, hear it, repeat it out loud."
                  />
                  <PillarCard
                    icon={<RefreshCw className="w-5 h-5" />}
                    pillar="Study & Review"
                    aliases="Retention · Feedback · Consistency"
                    title="Make it stick"
                    body="Spaced-repetition flashcards, grammar nudges and corrections. The boring bit done painlessly."
                  />
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <Eyebrow icon={<Sparkles className="w-3.5 h-3.5" />}>Quick setup</Eyebrow>
                <Title>Let's tune Linguascript to you.</Title>
                <Sub>Tell us your languages and current level — this powers translations and recommendations.</Sub>

                <div className="mt-8 space-y-6">
                  <Field label="I speak (native)">
                    <LangSelect value={native} onChange={setNative} exclude={target} />
                  </Field>
                  <Field label="I want to learn">
                    <FrenchOnlySelect />
                  </Field>

                  <Field label="My current level">
                    <div className="flex flex-wrap gap-2">
                      {LEVELS.map((l) => (
                        <button
                          key={l}
                          onClick={() => setLevel(l)}
                          className={`px-4 py-2 rounded-full text-sm font-medium border transition ${
                            level === l
                              ? "bg-orange-500 border-orange-500 text-white shadow-[0_6px_18px_-6px_rgba(249,115,22,0.6)]"
                              : "bg-white border-orange-100 text-neutral-700 hover:border-orange-300"
                          }`}
                        >
                          {l === "below" ? "Below A1" : l}
                        </button>
                      ))}
                    </div>
                    {level === "below" && (
                      <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200/70 p-4 text-sm text-neutral-700 leading-relaxed">
                        Linguascript works best for learners with basic foundations.
                        We recommend starting with <span className="font-medium">Duolingo</span> and returning when you reach A2. 🌱
                      </div>
                    )}
                  </Field>

                  <Field label="School (optional)">
                    <Input
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      placeholder="e.g. Truro College"
                      className="rounded-xl border-orange-100 bg-white h-11 focus-visible:ring-orange-300 text-neutral-900"
                    />
                    <p className="mt-2 text-xs text-neutral-500">
                      Add your school or college so we can connect you with classmates later. Skip if you're learning solo.
                    </p>
                  </Field>

                  <Field label="Daily input goal">
                    <DailyGoalPicker value={videoGoal} onChange={setVideoGoal} compact />
                  </Field>
                </div>
              </Card>
            )}


            {step === 2 && (
              <Card>
                <Eyebrow icon={<Sparkles className="w-3.5 h-3.5" />}>Card 1 of 5</Eyebrow>
                <Title>Welcome to the Lingua Universe 🌍</Title>
                <Sub>We're here to support your language learning goals.</Sub>

                <div className="mt-8 rounded-2xl bg-orange-50/60 border border-orange-100 p-5 text-[15px] leading-relaxed text-neutral-700">
                  Learners who write down clear goals before starting are{" "}
                  <span className="font-semibold text-orange-600">95% more likely</span> to succeed.
                </div>

                <div className="mt-6">
                  <label className="text-sm font-medium text-neutral-700 mb-2 block">Write your language goal</label>
                  <Textarea
                    value={goal}
                    onChange={(e) => { setGoal(e.target.value); setGoalSaved(false); }}
                    placeholder="e.g. Hold a 10-minute conversation in French by summer."
                    className="min-h-[110px] rounded-2xl border-orange-100 focus-visible:ring-orange-300 bg-white text-neutral-900"
                  />
                  <div className="mt-3 flex items-center gap-3">
                    <Button
                      onClick={saveGoal}
                      disabled={!goal.trim() || goalSaved}
                      className="rounded-full bg-orange-500 hover:bg-orange-600 text-white"
                    >
                      {goalSaved ? <><Check className="w-4 h-4" /> Saved</> : "Save goal"}
                    </Button>
                    {goalSaved && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        className="text-sm text-orange-600 font-medium"
                      >
                        Added to your Calendar ✨
                      </motion.span>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {step === 3 && (
              <Card>
                <Eyebrow icon={<Subtitles className="w-3.5 h-3.5" />}>Card 2 of 5</Eyebrow>
                <Title>Now learn by doing.</Title>
                <Sub>
                  Watch the 30-second intro, then enter the guided demo. A cursor will walk you through the entire Linguascript loop on a real video.
                </Sub>

                {/* Inline intro video — replace src with the Instagram intro reel when ready. */}
                <div className="mt-8 rounded-3xl overflow-hidden border border-orange-100 aspect-video bg-neutral-900 shadow-[0_24px_60px_-30px_rgba(249,115,22,0.4)]">
                  <iframe
                    title="Linguascript intro"
                    src={`https://www.youtube-nocookie.com/embed/${TOUR_TRAINING_YT_ID}?autoplay=0&modestbranding=1&rel=0&playsinline=1`}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="w-full h-full"
                    frameBorder={0}
                  />
                </div>

                <div className="mt-6 flex flex-col items-center gap-3">
                  <Button
                    onClick={async () => {
                      setEnteringDemo(true);
                      // Resolve training film by youtube_id
                      const { data: film } = await supabase
                        .from("films")
                        .select("id")
                        .or(`url.ilike.%${TOUR_TRAINING_YT_ID}%`)
                        .limit(1)
                        .maybeSingle();
                      if (!film?.id) {
                        toast.error("Training video missing from catalogue. Ask an admin to add it.");
                        setEnteringDemo(false);
                        return;
                      }
                      // Mark onboarded so /browse doesn't bounce them back here mid-tour
                      if (user) {
                        await supabase.from("profiles").update({ onboarded: true }).eq("user_id", user.id);
                      }
                      setDualClicked(true);
                      startTour({ trainingFilmId: film.id });
                      navigate(`/watch/${film.id}`);
                    }}
                    disabled={enteringDemo}
                    className="h-12 px-8 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-[0_8px_24px_-8px_rgba(249,115,22,0.6)] gap-2"
                  >
                    {enteringDemo ? "Loading…" : "Enter the demo"}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <p className="text-xs text-neutral-500">A guided cursor will walk you through every feature.</p>
                </div>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <Eyebrow icon={<Trophy className="w-3.5 h-3.5" />}>Card 3 of 5</Eyebrow>
                <Title>Catalogue & XP</Title>
                <Sub>Every video has a CEFR difficulty rating (A1 → C2). Watch content at your level for the fastest progress.</Sub>

                <div className="mt-8 grid sm:grid-cols-2 gap-4">
                  <InfoTile
                    icon={<BookOpen className="w-5 h-5" />}
                    title="Level XP"
                    body="Earned by completing flashcards. Beat a 1-minute grammar & vocab boss test to officially level up."
                  />
                  <InfoTile
                    icon={<Flame className="w-5 h-5" />}
                    title="Immersion XP"
                    body="Earned from watch time, daily streaks, best streaks and total flashcards reviewed."
                  />
                </div>
              </Card>
            )}

            {step === 5 && (
              <Card>
                <Eyebrow icon={<Brain className="w-3.5 h-3.5" />}>Card 4 of 5</Eyebrow>
                <Title>Flashcards & spaced repetition</Title>
                <Sub>Words are sorted into three memory decks. Press "Got it" to promote a card.</Sub>

                <div className="mt-8 grid grid-cols-3 gap-3">
                  {[
                    { name: "Short term", color: "from-orange-200 to-orange-300" },
                    { name: "Medium term", color: "from-orange-300 to-orange-400" },
                    { name: "Long term", color: "from-orange-400 to-orange-500" },
                  ].map((d) => (
                    <div key={d.name} className="rounded-2xl border border-orange-100 p-4 text-center">
                      <div className={`mx-auto w-10 h-10 rounded-xl bg-gradient-to-br ${d.color} mb-3`} />
                      <p className="text-sm font-medium text-neutral-900">{d.name}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-sm text-neutral-600">
                  We'll remind you to revisit each card right when your brain needs the reinforcement.
                </p>
              </Card>
            )}

            {step === 6 && (
              <Card>
                <Eyebrow icon={<Mic className="w-3.5 h-3.5" />}>Card 5 of 5</Eyebrow>
                <Title>Learn faster</Title>
                <Sub>Two habits unlock most of your gains.</Sub>

                <div className="mt-8 space-y-4">
                  <InfoTile
                    icon={<Mic className="w-5 h-5" />}
                    title="Shadowing"
                    body="Repeat words out loud right after the subtitles. Your accent will thank you."
                  />
                  <InfoTile
                    icon={<MousePointer2 className="w-5 h-5" />}
                    title="Word click"
                    body="Click any word for a live translation, native pronunciation and a one-tap add to your flashcard deck."
                  />
                </div>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Nav controls */}
        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0}
            className="rounded-full text-neutral-600 hover:text-neutral-900 hover:bg-orange-50"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={next}
            disabled={!canContinue}
            className="h-11 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-[0_8px_24px_-8px_rgba(249,115,22,0.5)] gap-2 disabled:opacity-40"
          >
            {step === totalSteps - 1 ? "Start learning" : "Continue"}
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </main>
    </div>
  );
};

const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-3xl bg-white border border-orange-100/80 shadow-[0_24px_60px_-30px_rgba(249,115,22,0.25)] p-7 sm:p-10">
    {children}
  </div>
);

const Eyebrow = ({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) => (
  <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-200/70 rounded-full px-3 py-1 mb-5 text-orange-600 text-xs font-medium">
    {icon} {children}
  </div>
);

const Title = ({ children }: { children: React.ReactNode }) => (
  <h1 className="text-[26px] sm:text-[34px] font-semibold tracking-[-0.02em] leading-[1.15] text-neutral-900">
    {children}
  </h1>
);

const Sub = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-3 text-[15px] sm:text-base text-neutral-500 leading-relaxed font-light">{children}</p>
);

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-sm font-medium text-neutral-700 mb-2 block">{label}</label>
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
      <SelectTrigger className="rounded-xl border-orange-100 bg-white h-11 text-neutral-900">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-white text-neutral-900">
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

const InfoTile = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-5">
    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-3">
      {icon}
    </div>
    <p className="font-semibold text-neutral-900">{title}</p>
    <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{body}</p>
  </div>
);

const PillarCard = ({
  icon, pillar, aliases, title, body,
}: { icon: React.ReactNode; pillar: string; aliases: string; title: string; body: string }) => (
  <div className="rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/60 to-white p-5 flex gap-4">
    <div className="shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 text-white flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(249,115,22,0.6)]">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="font-semibold text-neutral-900">{pillar}</p>
        <p className="text-[11px] text-orange-500 font-medium uppercase tracking-wide">{aliases}</p>
      </div>
      <p className="text-[13px] text-neutral-500 mt-0.5">{title}</p>
      <p className="mt-1.5 text-sm text-neutral-700 leading-relaxed">{body}</p>
    </div>
  </div>
);


const COMING_SOON_LANGS = [
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "it", label: "Italian", flag: "🇮🇹" },
  { code: "pt", label: "Portuguese", flag: "🇵🇹" },
];

const FrenchOnlySelect = () => (
  <div className="space-y-2">
    <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white px-4 h-11">
      <span className="text-xl">🇫🇷</span>
      <span className="font-medium text-neutral-900">French</span>
      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-orange-600 bg-orange-100/80 rounded-full px-2 py-0.5">
        <Check className="w-3 h-3" /> Available
      </span>
    </div>
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500 mb-2">Coming soon</p>
      <div className="grid grid-cols-2 gap-1.5">
        {COMING_SOON_LANGS.map((l) => (
          <div
            key={l.code}
            className="flex items-center gap-2 text-sm text-neutral-400 px-2 py-1.5 rounded-lg cursor-not-allowed"
          >
            <span>{l.flag}</span>
            <span>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default Onboarding;
