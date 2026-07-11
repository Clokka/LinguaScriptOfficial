import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { LANGUAGES } from "@/lib/languages";
import onboarding0 from "@/assets/mieoframes/onboarding.png.asset.json";
import onboarding1 from "@/assets/mieoframes/onboarding-1.png.asset.json";
import survey1 from "@/assets/mieoframes/survey-1.png.asset.json";

type Step = 0 | 1 | 2;

const useLiveClock = () => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(
        new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      );
    }, 15_000);
    return () => clearInterval(id);
  }, []);
  return time;
};

/**
 * Covers the fake status bar baked into the mockup art and prints the real
 * device time on the right. Background matches each frame's top color so the
 * seam is invisible.
 */
const StatusBarCover = ({ bg }: { bg: string }) => {
  const time = useLiveClock();
  return (
    <div
      className="absolute top-0 left-0 right-0 z-10 flex items-center justify-end px-6"
      style={{ height: "5%", background: bg }}
    >
      <span className="text-slate-900 font-semibold text-sm tabular-nums">
        {time}
      </span>
    </div>
  );
};

const Hotspot = ({
  top,
  left,
  width,
  height,
  onClick,
  label,
}: {
  top: string;
  left: string;
  width: string;
  height: string;
  onClick: () => void;
  label: string;
}) => (
  <button
    onClick={onClick}
    aria-label={label}
    className="absolute z-20 rounded-2xl focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4FB8F5]/50 hover:bg-white/10 active:bg-white/20 active:scale-[0.98] transition"
    style={{ top, left, width, height, background: "transparent" }}
  />
);

const FrameWrap = ({
  children,
  statusBg,
}: {
  children: React.ReactNode;
  statusBg: string;
}) => (
  <div className="min-h-dvh w-full" style={{ background: statusBg }}>
    <div className="mx-auto max-w-md relative">
      <StatusBarCover bg={statusBg} />
      {children}
    </div>
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
    navigate("/onboarding");
  };

  return (
    <AnimatePresence mode="wait">
      {step === 0 && (
        <motion.div
          key="s0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <FrameWrap>
            <img
              src={onboarding0.url}
              alt="Learn any language faster than ever"
              className="block w-full h-auto select-none"
              draggable={false}
            />
            {/* "Let's Get a Fresh Start" — primary CTA */}
            <Hotspot
              label="Let's Get a Fresh Start"
              top="64.5%"
              left="5%"
              width="90%"
              height="7.2%"
              onClick={goNext}
            />
            {/* "Resume Journey" — secondary CTA */}
            <Hotspot
              label="Resume Journey"
              top="72.5%"
              left="5%"
              width="90%"
              height="6.5%"
              onClick={() => navigate("/browse")}
            />
          </FrameWrap>
        </motion.div>
      )}

      {step === 1 && (
        <motion.div
          key="s1"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <FrameWrap>
            <img
              src={onboarding1.url}
              alt="I just want to ask you some questions"
              className="block w-full h-auto select-none"
              draggable={false}
            />
            {/* Back arrow, top-left */}
            <Hotspot
              label="Back"
              top="5.5%"
              left="3.5%"
              width="12%"
              height="5.5%"
              onClick={goBack}
            />
            {/* "Sure.! Continue" — bottom CTA */}
            <Hotspot
              label="Sure, continue"
              top="91%"
              left="5%"
              width="90%"
              height="7.5%"
              onClick={goNext}
            />
          </FrameWrap>
        </motion.div>
      )}

      {step === 2 && (
        <motion.div
          key="s2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="min-h-dvh w-full bg-gradient-to-b from-[#E4F3FC] via-[#EFF8FE] to-white"
        >
          <div className="mx-auto max-w-md px-6 pt-10 pb-8 flex flex-col min-h-dvh">
            <div className="flex items-center gap-3">
              <button
                onClick={goBack}
                aria-label="Back"
                className="h-12 w-12 rounded-2xl bg-white shadow-md flex items-center justify-center active:scale-95 transition"
              >
                <span className="text-xl text-slate-700">←</span>
              </button>
              <div className="flex-1 h-3 rounded-full bg-white/60 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-[#4FB8F5]" />
              </div>
            </div>

            <div className="mt-6 flex items-start gap-3">
              <img
                src={survey1.url}
                alt=""
                className="h-28 w-28 object-contain object-left"
              />
              <div className="relative mt-4 flex-1 rounded-2xl bg-white px-4 py-3 shadow-md">
                <p className="text-base font-semibold text-slate-800">
                  So..! What is your{" "}
                  <span className="text-[#4FB8F5] underline">Native</span> Language?
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
              <button
                onClick={handleFinishStep2}
                disabled={!nativeLang}
                className="relative w-full rounded-2xl bg-[#4FB8F5] py-4 text-lg font-bold text-white shadow-[0_6px_0_#2E93CC] active:translate-y-[2px] active:shadow-[0_4px_0_#2E93CC] transition disabled:opacity-50 overflow-hidden"
              >
                <span className="absolute inset-0 pointer-events-none">
                  <span className="absolute top-2 left-6 h-8 w-3 rotate-[20deg] bg-white/25 rounded-full" />
                  <span className="absolute top-2 left-12 h-8 w-1.5 rotate-[20deg] bg-white/20 rounded-full" />
                </span>
                <span className="relative">Next</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
