import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Languages, Flame, BookOpen, Brain } from "lucide-react";

const HOUSE_ADS = [
  {
    icon: Sparkles,
    title: "Did you know?",
    body: "Watching just 10 minutes of native content a day is proven to improve listening comprehension by 40% in 6 weeks.",
    cta: "Linguascript",
  },
  {
    icon: Languages,
    title: "16 languages, one method",
    body: "Lingua + Script: real subtitles, real videos, real progress. No flashcard grind required.",
    cta: "Linguascript",
  },
  {
    icon: Flame,
    title: "Streaks that stick.",
    body: "Daily 10-minute sessions outperform weekly hour-long ones. We send you a gentle nudge — never a guilt trip.",
    cta: "Linguascript",
  },
  {
    icon: BookOpen,
    title: "Learn from creators you love.",
    body: "Save any word from any video to your personal flashcard deck. Spaced repetition does the rest.",
    cta: "Linguascript",
  },
  {
    icon: Brain,
    title: "Three memory decks.",
    body: "Short, medium, long term. Every word travels through the system at the speed your brain needs.",
    cta: "Linguascript",
  },
];

interface Props {
  duration?: number; // total ad seconds
  skipAfter?: number; // skip allowed after N seconds
  onComplete: () => void;
}

export const AdLoader = ({ duration = 12, skipAfter = 5, onComplete }: Props) => {
  const [remaining, setRemaining] = useState(duration);
  const [ad] = useState(() => HOUSE_ADS[Math.floor(Math.random() * HOUSE_ADS.length)]);
  const Icon = ad.icon;

  useEffect(() => {
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          onComplete();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onComplete]);

  const canSkip = duration - remaining >= skipAfter;
  const progress = ((duration - remaining) / duration) * 100;

  return (
    <div className="absolute inset-0 z-30 bg-gradient-to-br from-orange-50 via-white to-orange-50/40 flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.title}
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-lg w-full text-center"
        >
          <motion.div
            initial={{ scale: 0.8, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center shadow-[0_12px_30px_-10px_rgba(249,115,22,0.5)] mb-6"
          >
            <Icon className="w-7 h-7 text-white" strokeWidth={2.2} />
          </motion.div>

          <p className="text-[11px] uppercase tracking-[0.18em] text-orange-500/80 font-semibold mb-3">
            From {ad.cta}
          </p>
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-[-0.02em] text-neutral-900 leading-[1.15]">
            {ad.title}
          </h2>
          <p className="mt-4 text-[15px] text-neutral-600 leading-relaxed font-light max-w-md mx-auto">
            {ad.body}
          </p>
        </motion.div>
      </AnimatePresence>

      {/* Bottom bar: progress + skip */}
      <div className="absolute bottom-6 left-6 right-6 max-w-xl mx-auto flex items-center gap-4">
        <div className="flex-1 h-1 bg-orange-100 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-orange-500"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
        </div>
        <button
          onClick={() => canSkip && onComplete()}
          disabled={!canSkip}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition shrink-0 ${
            canSkip
              ? "bg-neutral-900 text-white hover:bg-neutral-800"
              : "bg-orange-100 text-orange-500/70 cursor-not-allowed"
          }`}
        >
          {canSkip ? "Skip ad" : `Skip in ${skipAfter - (duration - remaining)}s`}
        </button>
      </div>

      <div className="absolute top-4 right-4 text-[10px] uppercase tracking-widest text-neutral-400 font-medium">
        Ad · Loading video…
      </div>
    </div>
  );
};
