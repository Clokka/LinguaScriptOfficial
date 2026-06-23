import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, ArrowLeft, Check, Sparkles, Languages, Subtitles,
  BookOpen, Brain, Mic, MousePointer2, Trophy, Flame, Puzzle, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LANGUAGES } from "@/lib/languages";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { playDing } from "@/lib/sound";
import { toast } from "sonner";
import PetSelection from "@/components/PetSelection";

const LEVELS = ["below", "A1", "A2", "B1", "B2", "C1", "C2"] as const;
type Level = typeof LEVELS[number];

const Onboarding = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { setLearningLanguage } = useLanguage();

  const [step, setStep] = useState(0);
  const [native, setNative] = useState("en");
  const [target, setTarget] = useState("fr");
  const [level, setLevel] = useState<Level | null>(null);
  const [goal, setGoal] = useState("");
  const [goalSaved, setGoalSaved] = useState(false);
  const [dualClicked, setDualClicked] = useState(false);
  const [petId, setPetId] = useState<string | null>(null);
  const [petName, setPetName] = useState<string | null>(null);
  const [petDone, setPetDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/onboarding");
  }, [user, authLoading, navigate]);

  // Load any existing profile values
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) {
        if (data.native_language) setNative(data.native_language);
        if (data.learning_language) setTarget(data.learning_language);
        if ((data as any).cef_level) setLevel((data as any).cef_level as Level);
        if ((data as any).learning_goal) setGoal((data as any).learning_goal);
        if ((data as any).onboarded) navigate("/browse");
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const totalSteps = 8;

  const canContinue = useMemo(() => {
    if (step === 0) return !!native && !!target && native !== target && !!level && level !== "below";
    if (step === 1) return petDone;
    if (step === 2) return goalSaved;
    if (step === 3) return dualClicked;
    return true;
  }, [step, native, target, level, petDone, goalSaved, dualClicked]);

  const next = async () => {
    if (step === 0 && user) {
      await supabase.from("profiles").update({
        native_language: native,
        learning_language: target,
        cef_level: level,
      }).eq("user_id", user.id);
      setLearningLanguage(target);
    }
    if (step === 1 && user && petId) {
      await supabase.from("profiles").update({
        pet_id: petId,
        pet_name: petName || petId,
      } as any).eq("user_id", user.id);
      localStorage.setItem('ls_pet', petId);
      if (petName) localStorage.setItem('ls_pet_name', petName);
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
                <Eyebrow icon={<Sparkles className="w-3.5 h-3.5" />}>Quick setup</Eyebrow>
                <Title>Let's tune Linguascript to you.</Title>
                <Sub>Tell us your languages and current level — this powers translations and recommendations.</Sub>

                <div className="mt-8 space-y-6">
                  <Field label="I speak (native)">
                    <LangSelect value={native} onChange={setNative} exclude={target} />
                  </Field>
                  <Field label="I want to learn">
                    <LangSelect value={target} onChange={setTarget} exclude={native} />
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
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card>
                <Eyebrow icon={<Sparkles className="w-3.5 h-3.5" />}>Choose your companion</Eyebrow>
                <PetSelection
                  onSelect={(id, name) => {
                    setPetId(id);
                    setPetName(name);
                    setPetDone(true);
                    playDing("success");
                  }}
                  onSkip={() => setPetDone(true)}
                />
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
                    className="min-h-[110px] rounded-2xl border-orange-100 focus-visible:ring-orange-300"
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
                <Title>How Linguascript works</Title>
                <Sub>
                  <span className="font-medium text-neutral-900">Lingua</span> = language (Latin).{" "}
                  <span className="font-medium text-neutral-900">Script</span> = our unique dual-subtitle system.
                </Sub>

                {/* Mock player */}
                <div className="mt-8 relative rounded-3xl overflow-hidden border border-orange-100 bg-neutral-900 aspect-video">
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900" />
                  <div className="absolute bottom-16 left-0 right-0 text-center px-4">
                    <p className="text-white text-base sm:text-lg font-medium drop-shadow">Bonjour, comment ça va ?</p>
                    <p className="text-orange-300 text-xs sm:text-sm mt-1">Hello, how are you?</p>
                  </div>
                  {/* Animated cursor */}
                  {!dualClicked && (
                    <motion.div
                      className="absolute"
                      initial={{ left: "20%", bottom: "20%", opacity: 0 }}
                      animate={{ left: "70%", bottom: "12%", opacity: 1 }}
                      transition={{ duration: 1.4, repeat: Infinity, repeatType: "reverse" }}
                    >
                      <MousePointer2 className="w-6 h-6 text-white drop-shadow" />
                    </motion.div>
                  )}
                  <button
                    onClick={() => { setDualClicked(true); playDing("success"); }}
                    className={`absolute right-4 bottom-4 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      dualClicked
                        ? "bg-orange-500 text-white"
                        : "bg-white/95 text-neutral-900 hover:bg-white animate-pulse"
                    }`}
                  >
                    {dualClicked ? <><Check className="w-3.5 h-3.5 inline -mt-0.5 mr-1" />Dual subtitles on</> : "Dual subtitles"}
                  </button>
                </div>

                <p className="mt-5 text-sm text-neutral-600 text-center">
                  {dualClicked ? "Nice! That's the magic." : "Click the Dual subtitles button to continue."}
                </p>
              </Card>
            )}

            {step === 4 && (
              <Card>
                <Eyebrow icon={<Puzzle className="w-3.5 h-3.5" />}>Card 3 of 5</Eyebrow>
                <Title>Your brain learns in colour.</Title>
                <Sub>
                  Most apps teach words in isolation. LinguaScript shows every word in context — and colours
                  them so you instantly know where you stand.
                </Sub>

                {/* Colour legend */}
                <div className="mt-8 space-y-3">
                  {[
                    { dot: "bg-neutral-200 border border-neutral-300", label: "White", meaning: "You haven't seen this word yet. No pressure." },
                    { dot: "bg-red-400",    label: "Red",    meaning: "Newly saved. Your brain is starting to form the memory." },
                    { dot: "bg-orange-400", label: "Orange", meaning: "You're actively learning it. Keep going." },
                    { dot: "bg-green-400",  label: "Green",  meaning: "Known. It's yours — you've earned this one." },
                  ].map(({ dot, label, meaning }) => (
                    <motion.div
                      key={label}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: ["White","Red","Orange","Green"].indexOf(label) * 0.12 }}
                      className="flex items-start gap-4 rounded-2xl border border-orange-100 bg-orange-50/30 p-4"
                    >
                      <span className={`mt-0.5 w-4 h-4 rounded-full flex-shrink-0 ${dot}`} />
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{label}</p>
                        <p className="text-sm text-neutral-500 mt-0.5 leading-relaxed">{meaning}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Mock subtitle preview */}
                <div className="mt-6 rounded-2xl bg-neutral-900 px-5 py-4 text-center">
                  <p className="text-base font-medium leading-loose">
                    {[
                      { word: "Au", color: "text-neutral-200" },
                      { word: "fur", color: "text-orange-400" },
                      { word: "et", color: "text-neutral-200" },
                      { word: "à", color: "text-neutral-200" },
                      { word: "mesure", color: "text-red-400" },
                      { word: "tu", color: "text-green-400" },
                      { word: "progresseras.", color: "text-neutral-200" },
                    ].map(({ word, color }) => (
                      <span key={word} className={`${color} mr-1.5 cursor-pointer hover:underline`}>{word}</span>
                    ))}
                  </p>
                  <p className="text-orange-300 text-xs mt-2">Little by little, you will progress.</p>
                </div>

                {/* Extension CTA */}
                <div className="mt-6 rounded-2xl border border-orange-200 bg-orange-50 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900">Install the Chrome Extension</p>
                    <p className="text-sm text-neutral-500 mt-0.5">
                      Get colour-coded words on Netflix & YouTube — dual subtitles, click any word, save instantly.
                    </p>
                  </div>
                  <a
                    href="https://chrome.google.com/webstore/detail/linguascript"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2.5 rounded-full transition shadow-[0_4px_14px_-4px_rgba(249,115,22,0.5)]"
                  >
                    Add to Chrome <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </Card>
            )}

            {step === 5 && (
              <Card>
                <Eyebrow icon={<Trophy className="w-3.5 h-3.5" />}>Card 4 of 6</Eyebrow>
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

            {step === 6 && (
              <Card>
                <Eyebrow icon={<Brain className="w-3.5 h-3.5" />}>Card 5 of 5</Eyebrow>
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

            {step === 7 && (
              <Card>
                <Eyebrow icon={<Mic className="w-3.5 h-3.5" />}>Card 6 of 6</Eyebrow>
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

const LangSelect = ({ value, onChange, exclude }: { value: string; onChange: (v: string) => void; exclude?: string }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="rounded-xl border-orange-100 bg-white h-11">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      {LANGUAGES.filter((l) => l.code !== exclude).map((l) => (
        <SelectItem key={l.code} value={l.code}>
          <span className="flex items-center gap-2"><span>{l.flag}</span> {l.label}</span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const InfoTile = ({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) => (
  <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-5">
    <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 flex items-center justify-center mb-3">
      {icon}
    </div>
    <p className="font-semibold text-neutral-900">{title}</p>
    <p className="mt-1 text-sm text-neutral-600 leading-relaxed">{body}</p>
  </div>
);

export default Onboarding;
