import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { StreakFlame } from "@/components/StreakFlame";
import { Check, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePet } from "@/contexts/PetContext";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageLabel } from "@/lib/languages";
import { supabase } from "@/integrations/supabase/client";
import { CELEBRATION_ATTR } from "@/components/rewards/LevelUpGift";
import { checkPetMilestones } from "@/lib/pets";

export interface StreakIgnitionDetail {
  streakCount: number;
  wordsReviewed: number;
  minutesWatched: number;
}

const EVENT = "linguascript:streak-ignited";

export function emitStreakIgnited(detail: StreakIgnitionDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StreakIgnitionDetail>(EVENT, { detail }));
}

/** Animated counter that ramps up from prev to target. */
const Counter = ({ from, to }: { from: number; to: number }) => {
  const [n, setN] = useState(from);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [from, to]);
  return <>{n}</>;
};

/**
 * Cinematic, near-fullscreen streak celebration. Mount once at the app root;
 * it listens for the "linguascript:streak-ignited" event and plays.
 */
export const StreakCelebrationModal = () => {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<StreakIgnitionDetail | null>(null);
  const { triggerReaction } = usePet();
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  // The streak screen just closes; a present comes from levelling up
  // (LevelUpGift waits for this screen to close), then any new pet.
  const finish = () => {
    setOpen(false);
    checkPetMilestones();
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const d = (e as CustomEvent<StreakIgnitionDetail>).detail;
      setDetail(d);
      setOpen(true);
      triggerReaction("dance", 5000);
    };
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, [triggerReaction]);

  if (typeof document === "undefined") return null;

  const count = detail?.streakCount ?? 1;
  const prev = Math.max(0, count - 1);

  return createPortal(
    <AnimatePresence>
      {open && detail && (
        <motion.div
          key="celeb"
          {...{ [CELEBRATION_ATTR]: "" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden"
        >
          {/* Dimmed cinematic backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={finish}
          />

          {/* Radial heat glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, rgba(249,115,22,0.35) 0%, rgba(99,102,241,0.18) 35%, transparent 65%)",
            }}
          />

          {/* Particle burst */}
          <Particles />

          {/* Close */}
          <button
            onClick={finish}
            aria-label="Close"
            className="absolute top-5 right-5 z-10 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center text-white/80"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content stack */}
          <motion.div
            initial={{ opacity: 0, scale: 0.7, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
            className="relative z-10 flex flex-col items-center justify-center px-6 text-center w-full max-w-[680px]"
          >
            {/* Label */}
            <motion.p
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-orange-300"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Daily mission complete
            </motion.p>

            {/* Flame + overlaid streak number. The canvas scales to whatever
                size it is given, which the raster Lottie did not. */}
            <div className="relative mt-4 w-[min(78vw,460px)] h-[min(78vw,460px)] flex items-center justify-center">
              <StreakFlame active size={Math.min(window.innerWidth * 0.78, 460)} />
              <motion.div
                initial={{ opacity: 0, scale: 0.4 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
              >
                <span
                  className="font-black tabular-nums leading-none"
                  style={{
                    fontSize: "clamp(80px, 22vw, 200px)",
                    color: "#FFF7ED",
                    textShadow:
                      "0 0 40px rgba(249,115,22,0.9), 0 0 90px rgba(249,115,22,0.55), 0 4px 12px rgba(0,0,0,0.55)",
                    WebkitTextStroke: "1px rgba(255,255,255,0.15)",
                  }}
                >
                  <Counter from={prev} to={count} />
                </span>
              </motion.div>
            </div>

            {/* Headline */}
            <motion.h2
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65 }}
              className="mt-2 text-4xl sm:text-5xl font-bold tracking-tight text-white"
            >
              {count === 1 ? "Streak ignited" : `${count}-day streak!`}
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-5 w-full max-w-sm"
            >
              <WeekRow userId={user?.id ?? null} />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.9 }}
              className="mt-4 text-base text-white/70 max-w-md"
            >
              <b className="text-orange-300">{detail.wordsReviewed}</b> {detail.wordsReviewed === 1 ? "word" : "words"}
              {detail.minutesWatched > 0 && (
                <> · <b className="text-orange-300">{detail.minutesWatched}</b> min of {getLanguageLabel(learningLanguage || "fr")}</>
              )}
              {" "}today. See you tomorrow.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.95 }}
              className="mt-7"
            >
              <Button
                onClick={finish}
                size="lg"
                className="rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-[0_10px_40px_-10px_rgba(249,115,22,0.7)] px-8"
              >
                Continue
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

function isoDay(d: Date) {
  return d.toISOString().split("T")[0];
}

/**
 * This week at a glance (Mon–Sun): days the goal was met get a check, today
 * gets the flame, days still to come are dashed outlines.
 */
function WeekRow({ userId }: { userId: string | null }) {
  const [met, setMet] = useState<Set<string>>(new Set());
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return isoDay(d);
  });
  const today = isoDay(now);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("activity_log").select("date")
      .eq("user_id", userId).eq("goal_met", true)
      .gte("date", days[0]).lte("date", days[6])
      .then(({ data }) => setMet(new Set((data || []).map((r) => r.date))));
    // days is derived from today's date; refetching once per open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <ol className="flex justify-between">
      {days.map((day, i) => {
        const isToday = day === today;
        const done = isToday || met.has(day);
        const future = day > today;
        return (
          <li key={day} className="flex flex-col items-center gap-2">
            <span className={`text-xs font-bold ${done ? "text-orange-300" : "text-white/35"}`}>{WEEK_LETTERS[i]}</span>
            <span
              className={[
                "flex h-10 w-10 items-center justify-center rounded-full",
                isToday
                  ? "bg-gradient-to-b from-amber-400 to-orange-600 shadow-[0_0_20px_rgba(249,115,22,0.7)]"
                  : done
                    ? "bg-orange-400"
                    : future
                      ? "border-2 border-dashed border-white/20"
                      : "bg-white/10",
              ].join(" ")}
            >
              {isToday ? <span aria-hidden>🔥</span> : done ? <Check className="h-5 w-5 text-white" strokeWidth={3} /> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Lightweight particle burst — pure CSS/Framer, no canvas. */
const Particles = () => {
  const dots = Array.from({ length: 28 });
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {dots.map((_, i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        const dist = 220 + Math.random() * 180;
        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;
        const colors = ["#fb923c", "#f59e0b", "#fcd34d", "#a78bfa"];
        const color = colors[i % colors.length];
        return (
          <motion.span
            key={i}
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x, y, opacity: [0, 1, 0], scale: [0.4, 1.1, 0.6] }}
            transition={{ duration: 1.6 + Math.random() * 0.6, delay: 0.2, ease: "easeOut" }}
            className="absolute block rounded-full"
            style={{
              width: 6 + Math.random() * 6,
              height: 6 + Math.random() * 6,
              background: color,
              boxShadow: `0 0 16px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};
