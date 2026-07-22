import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePet } from "@/contexts/PetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { getPetById } from "@/lib/pets";
import { getLanguageColor, ColorValue } from "@/lib/felixColors";
import { PetViewer, PetAnimation } from "./PetViewer";

// --- Animation mapping per reaction ---
const REACTION_TO_ANIMATION: Record<string, PetAnimation> = {
  celebrate: "Celebrate",
  dance:     "Dance",
  wave:      "Wave",
  happy:     "Happy",
  excited:   "Excited",
  perfect:   "Celebrate", // starts here; companion cycles through all three
  idle:      "Idle",
};

// Speech bubble messages
const REACTION_MESSAGES: Record<string, string[]> = {
  celebrate: ["You did it! 🎉", "Amazing work! ✨", "Incredible! 🏆"],
  dance:     ["Let's go! 💃", "Streak master! 🔥"],
  wave:      ["Hey! 👋", "Welcome back! 🌟"],
  happy:     ["Word saved! 💚", "Nice one! ✨", "Keep going! 🎯"],
  excited:   ["LEVEL UP! 🤩", "That's huge! ⚡"],
  perfect:   ["PERFECT! 100%!! 🏆🎉✨", "FLAWLESS! 🌟💫🎊"],
};

// For the chained "perfect" sequence: Celebrate → Dance → Excited, 3s each
const PERFECT_CHAIN: PetAnimation[] = ["Celebrate", "Dance", "Excited"];
const PERFECT_STEP_MS = 3000;

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function PetCompanion() {
  const { activePet, reaction, isCompanionVisible } = usePet();
  const { languageContext } = useLanguage();
  const [message, setMessage] = useState<string | null>(null);
  const [chainStep, setChainStep] = useState(0);
  const [languageColor, setLanguageColor] = useState<ColorValue | undefined>();
  const pet = activePet ? getPetById(activePet) : null;

  // Update color when language changes (Felix only)
  useEffect(() => {
    if (activePet === "felix") {
      setLanguageColor(getLanguageColor(languageContext));
    } else {
      setLanguageColor(undefined);
    }
  }, [languageContext, activePet]);

  // Update speech bubble on reaction change
  useEffect(() => {
    if (reaction === "idle") { setMessage(null); return; }
    const msgs = REACTION_MESSAGES[reaction];
    if (msgs) setMessage(pick(msgs));
  }, [reaction]);

  // Chain animations for "perfect"
  useEffect(() => {
    if (reaction !== "perfect") { setChainStep(0); return; }
    setChainStep(0);
    const t1 = setTimeout(() => setChainStep(1), PERFECT_STEP_MS);
    const t2 = setTimeout(() => setChainStep(2), PERFECT_STEP_MS * 2);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [reaction]);

  if (!pet || !isCompanionVisible) return null;

  const isPerfect = reaction === "perfect";
  const isActive = reaction !== "idle";

  // Pick animation
  const animation: PetAnimation = isPerfect
    ? PERFECT_CHAIN[chainStep] ?? "Celebrate"
    : (REACTION_TO_ANIMATION[reaction] ?? "Idle");

  // Size: bigger during perfect
  const size = isPerfect ? 130 : 80;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2 pointer-events-none select-none">

      {/* Perfect mode: full celebration banner above the pet */}
      <AnimatePresence>
        {isPerfect && (
          <motion.div
            key="perfect-banner"
            initial={{ opacity: 0, scale: 0.7, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-white rounded-2xl px-4 py-2 text-sm font-bold shadow-xl shadow-amber-500/30 text-center max-w-[180px]"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regular speech bubble */}
      <AnimatePresence>
        {!isPerfect && message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            className="relative bg-background/90 backdrop-blur border border-border rounded-xl px-3 py-1.5 text-sm font-medium text-foreground shadow-lg max-w-[160px] text-center"
          >
            {message}
            <div className="absolute bottom-[-6px] right-8 w-3 h-3 bg-background/90 border-r border-b border-border rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pet model */}
      <motion.div
        animate={
          isPerfect
            ? {
                y: [0, -14, 0, -14, 0],
                scale: [1, 1.12, 1, 1.12, 1],
                rotate: [0, -4, 4, -4, 0],
              }
            : isActive
            ? { y: [0, -6, 0, -6, 0], scale: [1, 1.05, 1, 1.05, 1] }
            : { y: [0, -3, 0], scale: [1, 1, 1] }
        }
        transition={
          isPerfect
            ? { duration: 0.9, times: [0, 0.25, 0.5, 0.75, 1], repeat: Infinity }
            : isActive
            ? { duration: 0.8, times: [0, 0.25, 0.5, 0.75, 1] }
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
        className="rounded-full overflow-hidden border-2 shadow-lg bg-background/30 backdrop-blur transition-all duration-500"
        style={{
          borderColor: isPerfect ? "rgba(251,191,36,0.6)" : "rgba(99,102,241,0.3)",
          boxShadow: isPerfect ? "0 0 32px rgba(251,191,36,0.4), 0 8px 24px rgba(0,0,0,0.3)" : undefined,
          width: size,
          height: size,
        } as React.CSSProperties}
      >
        <PetViewer
          glbFile={pet.glbFile}
          animation={animation}
          size={size}
          languageColor={languageColor}
        />
      </motion.div>
    </div>
  );
}
