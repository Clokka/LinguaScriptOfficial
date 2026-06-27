import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePet } from "@/contexts/PetContext";
import { getPetById } from "@/lib/pets";
import { PetViewer, PetAnimation } from "./PetViewer";

const REACTION_MESSAGES: Record<string, string[]> = {
  celebrate: ["You did it! 🎉", "Amazing work! ✨", "Incredible! 🏆"],
  dance: ["Let's celebrate! 💃", "Keep it up! 🕺"],
  wave: ["Hello! 👋", "Welcome back! 🌟"],
  happy: ["Great job! 😊", "You're on fire! 🔥"],
  excited: ["WOW! 🤩", "That's huge! ⚡"],
};

const REACTION_TO_ANIMATION: Record<string, PetAnimation> = {
  celebrate: "Celebrate",
  dance: "Dance",
  wave: "Wave",
  happy: "Happy",
  excited: "Excited",
  idle: "Idle",
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function PetCompanion() {
  const { activePet, reaction, isCompanionVisible } = usePet();
  const [message, setMessage] = useState<string | null>(null);
  const pet = activePet ? getPetById(activePet) : null;

  useEffect(() => {
    if (reaction === "idle") {
      setMessage(null);
      return;
    }
    const msgs = REACTION_MESSAGES[reaction];
    if (msgs) setMessage(pick(msgs));
  }, [reaction]);

  if (!pet || !isCompanionVisible) return null;

  const animation = REACTION_TO_ANIMATION[reaction] ?? "Idle";

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-center gap-2 pointer-events-none select-none">
      {/* Speech bubble */}
      <AnimatePresence>
        {message && (
          <motion.div
            key={message}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            className="bg-background/90 backdrop-blur border border-border rounded-xl px-3 py-1.5 text-sm font-medium text-foreground shadow-lg max-w-[140px] text-center"
          >
            {message}
            {/* Bubble tail */}
            <div className="absolute bottom-[-6px] right-8 w-3 h-3 bg-background/90 border-r border-b border-border rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pet model */}
      <motion.div
        animate={
          reaction !== "idle"
            ? { y: [0, -6, 0, -6, 0], scale: [1, 1.05, 1, 1.05, 1] }
            : { y: [0, -3, 0], scale: [1, 1, 1] }
        }
        transition={
          reaction !== "idle"
            ? { duration: 0.8, times: [0, 0.25, 0.5, 0.75, 1] }
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
        }
        className="rounded-full overflow-hidden border-2 border-primary/30 shadow-lg bg-background/30 backdrop-blur w-[80px] h-[80px]"
      >
        <PetViewer
          glbFile={pet.glbFile}
          animation={animation}
          size={80}
        />
      </motion.div>
    </div>
  );
}
