// Interactive mobile onboarding flow rebuilt from Figma reference frames.
// 8 screens wired end-to-end with hotspots overlaid on the reference art.
// The status bar area (fake 9:41 + signal/wifi/battery) is masked with a
// cover that shows the device's real time.
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import entry from "@/assets/mieoframes2/01EntryFlow.png.asset.json";
import login from "@/assets/mieoframes2/02Login.png.asset.json";
import signup from "@/assets/mieoframes2/03NewAccountProgress.png.asset.json";
import home from "@/assets/mieoframes2/04Home.png.asset.json";
import game from "@/assets/mieoframes2/05GamePlay.png.asset.json";
import result from "@/assets/mieoframes2/06Result.png.asset.json";
import streak from "@/assets/mieoframes2/07StreakMieoTalk.png.asset.json";
import profile from "@/assets/mieoframes2/08Profile.png.asset.json";
import shop from "@/assets/mieoframes/shop.png.asset.json";
import leaderboard from "@/assets/mieoframes/leaderboard-week-start.png.asset.json";

type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

const useLiveClock = () => {
  const [time, setTime] = useState(() =>
    new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  );
  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 15_000);
    return () => clearInterval(id);
  }, []);
  return time;
};

/**
 * Small pill masking just the baked-in "9:41" on the left of the status bar,
 * printing the device's real time. Keeps the rest of the mockup's top section
 * (header art, notch, right-side icons) visible.
 */
const StatusBarCover = ({ bg }: { bg: string }) => {
  const time = useLiveClock();
  return (
    <div
      className="absolute z-20 flex items-center justify-start pl-6"
      style={{ top: "1.1%", left: 0, height: "2.2%", width: "34%", background: bg }}
    >
      <span className="text-slate-900 font-semibold text-[11px] leading-none tabular-nums">{time}</span>
    </div>
  );
};

const Hotspot = ({
  top, left, width, height, onClick, label, rounded = "rounded-2xl",
}: {
  top: string; left: string; width: string; height: string;
  onClick: () => void; label: string; rounded?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    className={`absolute z-30 ${rounded} bg-transparent cursor-pointer touch-manipulation appearance-none border-0 p-0 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#4FB8F5]/50 hover:bg-white/10 active:bg-white/25 active:scale-[0.98] transition-transform duration-100`}
    style={{ top, left, width, height }}
  />
);

const FrameWrap = ({
  imgSrc, alt, statusBg, children,
}: {
  imgSrc: string; alt: string; statusBg: string; children?: React.ReactNode;
}) => (
  <div className="min-h-dvh w-full" style={{ background: statusBg }}>
    <div className="mx-auto max-w-md relative">
      <img
        src={imgSrc}
        alt={alt}
        className="block w-full h-auto select-none pointer-events-none"
        draggable={false}
      />
      <StatusBarCover bg={statusBg} />
      {children}
    </div>
  </div>
);

export default function OnboardingMobile() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(0);
  const go = (s: Step) => setStep(s);

  return (
    <AnimatePresence mode="wait">
      {/* 0 — Entry Flow / splash */}
      {step === 0 && (
        <motion.div key="s0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={entry.url} alt="Learning with LinguaScript" statusBg="#BFE1F5">
            {/* Whole screen advances to Login on tap */}
            <Hotspot label="Continue to login" top="10%" left="0%" width="100%" height="85%" onClick={() => go(1)} rounded="rounded-none" />
          </FrameWrap>
        </motion.div>
      )}

      {/* 1 — Login */}
      {step === 1 && (
        <motion.div key="s1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={login.url} alt="Welcome back — login" statusBg="#CDECFA">
            {/* Login Now (blue CTA) */}
            <Hotspot label="Login Now" top="55%" left="6%" width="88%" height="6.5%" onClick={() => go(2)} />
            {/* Google */}
            <Hotspot label="Continue with Google" top="76%" left="6%" width="41%" height="5.5%" onClick={() => go(2)} />
            {/* Apple */}
            <Hotspot label="Continue with Apple" top="76%" left="53%" width="41%" height="5.5%" onClick={() => go(2)} />
          </FrameWrap>
        </motion.div>
      )}

      {/* 2 — New Account Progress / Meet Mieo */}
      {step === 2 && (
        <motion.div key="s2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={signup.url} alt="Meet LinguaScript" statusBg="#BFE1F5">
            {/* Back arrow top-left */}
            <Hotspot label="Back" top="6.5%" left="4%" width="12%" height="5.5%" onClick={() => go(1)} />
            {/* "Say Hi to LinguaScript" bottom CTA */}
            <Hotspot label="Say Hi to LinguaScript" top="90%" left="6%" width="88%" height="7%" onClick={() => go(3)} />
          </FrameWrap>
        </motion.div>
      )}

      {/* 3 — Home / dashboard */}
      {step === 3 && (
        <motion.div key="s3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={home.url} alt="Home dashboard" statusBg="#CDECFA">
            {/* Level / Unit card → open lesson */}
            <Hotspot label="Open current unit" top="17%" left="4%" width="92%" height="8%" onClick={() => go(4)} />
            {/* Main lesson flag button on the path */}
            <Hotspot label="Start lesson" top="47%" left="30%" width="30%" height="12%" onClick={() => go(4)} rounded="rounded-full" />
            {/* Bottom nav — home (active), streak, video, achievements, profile */}
            <Hotspot label="Home tab" top="92%" left="12%" width="14%" height="6%" onClick={() => go(3)} rounded="rounded-full" />
            <Hotspot label="Streak tab" top="92%" left="27%" width="14%" height="6%" onClick={() => go(6)} rounded="rounded-full" />
            <Hotspot label="Practice tab" top="92%" left="43%" width="14%" height="6%" onClick={() => go(4)} rounded="rounded-full" />
            <Hotspot label="Achievements tab" top="92%" left="58%" width="14%" height="6%" onClick={() => go(5)} rounded="rounded-full" />
            <Hotspot label="Profile tab" top="92%" left="73%" width="14%" height="6%" onClick={() => go(7)} rounded="rounded-full" />
          </FrameWrap>
        </motion.div>
      )}

      {/* 4 — Game Play */}
      {step === 4 && (
        <motion.div key="s4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={game.url} alt="Choose the right options" statusBg="#CDECFA">
            {/* Back arrow */}
            <Hotspot label="Back" top="7%" left="4%" width="12%" height="5.5%" onClick={() => go(3)} />
            {/* Check CTA */}
            <Hotspot label="Check answer" top="90%" left="4%" width="92%" height="7%" onClick={() => go(5)} />
          </FrameWrap>
        </motion.div>
      )}

      {/* 5 — Result */}
      {step === 5 && (
        <motion.div key="s5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={result.url} alt="You just did it — result" statusBg="#CDECFA">
            {/* Continue */}
            <Hotspot label="Continue" top="89%" left="4%" width="92%" height="8%" onClick={() => go(6)} />
          </FrameWrap>
        </motion.div>
      )}

      {/* 6 — Streak & Mieo Talk */}
      {step === 6 && (
        <motion.div key="s6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={streak.url} alt="My streak" statusBg="#FCE9B8">
            {/* Bottom nav */}
            <Hotspot label="Home tab" top="94%" left="12%" width="14%" height="5%" onClick={() => go(3)} rounded="rounded-full" />
            <Hotspot label="Streak tab" top="94%" left="27%" width="14%" height="5%" onClick={() => go(6)} rounded="rounded-full" />
            <Hotspot label="Practice tab" top="94%" left="43%" width="14%" height="5%" onClick={() => go(4)} rounded="rounded-full" />
            <Hotspot label="Achievements tab" top="94%" left="58%" width="14%" height="5%" onClick={() => go(5)} rounded="rounded-full" />
            <Hotspot label="Profile tab" top="94%" left="73%" width="14%" height="5%" onClick={() => go(7)} rounded="rounded-full" />
          </FrameWrap>
        </motion.div>
      )}

      {/* 7 — Profile */}
      {step === 7 && (
        <motion.div key="s7" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <FrameWrap imgSrc={profile.url} alt="Profile" statusBg="#CDECFA">
            {/* Settings CTA */}
            <Hotspot label="Settings" top="87.5%" left="5%" width="90%" height="4%" onClick={() => navigate("/profile")} />
            {/* Bottom nav */}
            <Hotspot label="Home tab" top="94%" left="12%" width="14%" height="5%" onClick={() => go(3)} rounded="rounded-full" />
            <Hotspot label="Streak tab" top="94%" left="27%" width="14%" height="5%" onClick={() => go(6)} rounded="rounded-full" />
            <Hotspot label="Practice tab" top="94%" left="43%" width="14%" height="5%" onClick={() => go(4)} rounded="rounded-full" />
            <Hotspot label="Achievements tab" top="94%" left="58%" width="14%" height="5%" onClick={() => go(5)} rounded="rounded-full" />
            <Hotspot label="Profile tab" top="94%" left="73%" width="14%" height="5%" onClick={() => go(7)} rounded="rounded-full" />
          </FrameWrap>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
