import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";
import onboarding0 from "@/assets/mieoframes/onboarding.png.asset.json";
import onboarding1 from "@/assets/mieoframes/onboarding-1.png.asset.json";
import survey1 from "@/assets/mieoframes/survey-1.png.asset.json";

type Step = 0 | 1 | 2;

const PrimaryButton = ({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="relative w-full rounded-2xl bg-[#4FB8F5] py-4 text-lg font-bold text-white shadow-[0_6px_0_#2E93CC] active:translate-y-[2px] active:shadow-[0_4px_0_#2E93CC] transition disabled:opacity-50 overflow-hidden"
  >
    <span className="absolute inset-0 pointer-events-none">
      <span className="absolute top-2 left-6 h-8 w-3 rotate-[20deg] bg-white/25 rounded-full" />
      <span className="absolute top-2 left-12 h-8 w-1.5 rotate-[20deg] bg-white/20 rounded-full" />
    </span>
    <span className="relative">{children}</span>
  </button>
);

const SecondaryButton = ({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="w-full rounded-2xl border-2 border-slate-200 bg-white py-4 text-lg font-bold text-slate-800 active:bg-slate-50 transition"
  >
    {children}
  </button>
);

const BackButton = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    aria-label="Back"
    className="h-12 w-12 rounded-2xl bg-white shadow-md flex items-center justify-center active:scale-95 transition"
  >
    <ArrowLeft className="h-5 w-5 text-slate-700" />
  </button>
);

// Sky gradient shared across steps
const SkyBg = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh w-full bg-gradient-to-b from-[#E4F3FC] via-[#EFF8FE] to-white">
    {children}
  </div>
);

export default function OnboardingMobile() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const [nativeLang, setNativeLang] = useState<string>(() => {
    try {
      return localStorage.getItem("onboardingNativeLang") || "";
    } catch {
      return "";
    }
  });

  const goNext = () => setStep((s) => (Math.min(2, s + 1) as Step));
  const goBack = () => setStep((s) => (Math.max(0, s - 1) as Step));

  const handleFinishStep2 = () => {
    if (!nativeLang) return;
    try {
      localStorage.setItem("onboardingNativeLang", nativeLang);
    } catch {}
    // Hand off to full onboarding flow
    navigate("/onboarding");
  };

  return (
    <SkyBg>
      <div className="mx-auto max-w-md min-h-dvh flex flex-col px-6 pt-10 pb-8">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.section
              key="s0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="inline-flex items-center gap-2 self-start rounded-2xl border border-[#B7DFF5] bg-white/70 px-4 py-2">
                <ShieldCheck className="h-4 w-4 text-[#4FB8F5]" />
                <span className="text-sm font-semibold text-[#4FB8F5]">100% Kids Safe</span>
              </div>

              <h1 className="mt-6 text-4xl font-extrabold leading-tight text-slate-900">
                Learn any <span className="text-[#4FB8F5]">Language</span>
                <br />
                Faster than ever.
              </h1>

              <div className="flex-1 flex items-center justify-center py-6">
                <motion.img
                  src={onboarding0.url}
                  alt="LinguaScript mascot standing on language stones in the clouds"
                  className="max-h-[52vh] w-auto object-contain"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              <div className="space-y-3">
                <PrimaryButton onClick={goNext}>Let's Get a Fresh Start</PrimaryButton>
                <SecondaryButton onClick={() => navigate("/browse")}>
                  Resume Journey
                </SecondaryButton>
              </div>
            </motion.section>
          )}

          {step === 1 && (
            <motion.section
              key="s1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <BackButton onClick={goBack} />

              <div className="flex-1 flex flex-col items-center justify-end">
                <div className="relative mb-3 max-w-[85%] rounded-2xl bg-white px-5 py-4 shadow-md">
                  <p className="text-center text-lg font-semibold text-slate-800">
                    Yey..! I just want to ask you some{" "}
                    <span className="text-[#4FB8F5]">Questions</span>. Please…!
                  </p>
                  <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-4 w-4 rotate-45 bg-white shadow-md" />
                </div>
                <motion.img
                  src={onboarding1.url}
                  alt="Excited LinguaScript mascot"
                  className="max-h-[55vh] w-auto object-contain"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>

              <div className="pt-6">
                <PrimaryButton onClick={goNext}>Sure! Continue</PrimaryButton>
              </div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="s2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col"
            >
              <div className="flex items-center gap-3">
                <BackButton onClick={goBack} />
                <div className="flex-1 h-3 rounded-full bg-white/60 overflow-hidden">
                  <div className="h-full w-1/3 rounded-full bg-[#4FB8F5]" />
                </div>
              </div>

              <div className="mt-6 flex items-start gap-3">
                <img
                  src={survey1.url}
                  alt="Mascot with a speech bubble"
                  className="h-28 w-28 object-contain"
                />
                <div className="relative mt-4 flex-1 rounded-2xl bg-white px-4 py-3 shadow-md">
                  <p className="text-base font-semibold text-slate-800">
                    So..! What is your <span className="text-[#4FB8F5] underline">Native</span>{" "}
                    Language?
                  </p>
                  <span className="absolute left-[-6px] top-6 h-3 w-3 rotate-45 bg-white" />
                </div>
              </div>

              <div className="mt-6 space-y-3 flex-1 overflow-y-auto pb-4">
                {LANGUAGES.map((lang) => {
                  const selected = nativeLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => setNativeLang(lang.code)}
                      className={`w-full rounded-2xl border-2 bg-white px-4 py-4 flex items-center gap-3 transition ${
                        selected
                          ? "border-[#4FB8F5] shadow-[0_0_0_3px_rgba(79,184,245,0.15)]"
                          : "border-slate-200"
                      }`}
                    >
                      <span className="text-2xl">{lang.flag}</span>
                      <span className="flex-1 text-left text-lg font-semibold text-slate-800">
                        {lang.label}
                      </span>
                      <span
                        className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${
                          selected ? "border-[#4FB8F5] bg-[#4FB8F5]" : "border-slate-300"
                        }`}
                      >
                        {selected && <Check className="h-4 w-4 text-white" />}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="pt-4">
                <PrimaryButton onClick={handleFinishStep2} disabled={!nativeLang}>
                  Next
                </PrimaryButton>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </SkyBg>
  );
}
