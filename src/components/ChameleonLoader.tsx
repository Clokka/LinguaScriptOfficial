import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import red from "@/assets/brand/chameleon-red.png.asset.json";
import orange from "@/assets/brand/chameleon-orange.png.asset.json";
import green from "@/assets/brand/chameleon-green.png.asset.json";

const STAGES = [
  { src: red.url, label: "Red", text: "New words you don't know yet", cls: "text-destructive" },
  { src: orange.url, label: "Orange", text: "Words you're learning", cls: "text-accent" },
  { src: green.url, label: "Green", text: "Words you understand", cls: "text-emerald-500" },
];

/** Branded "The Chameleon Method" screen: the 2D chameleon turns red → orange → green. */
export function ChameleonMark({ size = 112 }: { size?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % STAGES.length), 1100);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <AnimatePresence mode="popLayout">
        <motion.img
          key={i}
          src={STAGES[i].src}
          alt="LinguaScript chameleon"
          className="absolute inset-0 h-full w-full object-contain"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        />
      </AnimatePresence>
    </div>
  );
}

interface Props {
  /** Called after `duration` ms if nothing else replaces this screen. */
  onComplete?: () => void;
  duration?: number;
  message?: string;
}

export function ChameleonLoader({ onComplete, duration = 5000, message = "Getting your video ready…" }: Props) {
  useEffect(() => {
    if (!onComplete) return;
    const t = setTimeout(onComplete, duration);
    return () => clearTimeout(t);
  }, [onComplete, duration]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/95 backdrop-blur overflow-y-auto p-4">
      <div className="flex flex-col items-center text-center max-w-sm">
        <ChameleonMark />
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-widest text-primary">The Chameleon Method</p>
        <p className="mt-1 text-lg font-semibold text-foreground">Turn the language green</p>
        <ul className="mt-3 space-y-1 text-sm">
          {STAGES.map((s) => (
            <li key={s.label} className="text-muted-foreground">
              <span className={`font-semibold ${s.cls}`}>{s.label}</span> — {s.text}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
