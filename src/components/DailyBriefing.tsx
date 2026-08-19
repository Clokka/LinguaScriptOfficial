import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStreakStatus } from "@/hooks/useStreakStatus";
import { StreakFlame } from "./StreakFlame";
import { DailyGoalPicker } from "./DailyGoalPicker";
import { normalizeWordGoal, videoGoalForWords } from "@/lib/progressStats";

const dismissKey = (uid: string) => `briefing:${uid}:${new Date().toISOString().split("T")[0]}`;

/**
 * The once-a-day briefing: where the streak stands, and what today needs.
 *
 * It used to be a three-step white modal dropped into a dark app, and it opened
 * with a paragraph about the predictive value of consistency before telling
 * anyone what to do. A returning learner met that every single session.
 *
 * Three faults were worth more than the styling:
 *
 *  - It read "Yesterday you watched 0 min and reviewed 0 words" while showing
 *    TODAY's counters, which are naturally zero at sign-in. It reported a fresh
 *    day as a failed one, every morning.
 *  - A goal saved before the word-goal switch (10, 20, 40) matched no preset, so
 *    nothing was highlighted and the closing line quoted a target the picker did
 *    not offer.
 *  - The panel was white on a dark product.
 *
 * Now: one screen, dark, the number first. The goal picker only appears when
 * there is a real decision to make.
 */
export const DailyBriefing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [wordGoal, setWordGoal] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const streak = useStreakStatus();

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded, show_daily_briefing, daily_word_goal")
        .eq("user_id", user.id)
        .single();
      if (cancelled) return;
      const p: any = data || {};
      const stored = p.daily_word_goal;
      const normalized = normalizeWordGoal(stored);
      setWordGoal(normalized);
      // A goal off the current scale is a decision the learner never actually
      // made, so ask for one rather than quietly assuming.
      setChoosing(normalized !== stored);
      setProfileChecked(true);

      const dismissed =
        typeof window !== "undefined" && localStorage.getItem(dismissKey(user.id)) === "1";
      if (p.onboarded && p.show_daily_briefing && !dismissed) setOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  const close = () => {
    if (user) localStorage.setItem(dismissKey(user.id), "1");
    setOpen(false);
  };

  const saveGoal = async (words: number) => {
    setWordGoal(words);
    setChoosing(false);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        daily_word_goal: words,
        daily_video_goal: videoGoalForWords(words),
      } as any)
      .eq("user_id", user.id);
    void streak.refresh();
  };

  if (!open || !profileChecked || wordGoal == null) return null;

  const remaining = Math.max(0, wordGoal - streak.wordsReviewed);
  const done = remaining === 0;

  return (
    <AnimatePresence>
      <motion.div
        key="bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
        onClick={close}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-label="Today's mission"
          className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0f1714] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
        >
          <button
            onClick={close}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
          >
            <X className="h-4 w-4" />
          </button>

          {/* The flame carries the state; the number carries the fact. */}
          <div className="flex flex-col items-center px-7 pb-2 pt-9 text-center">
            <StreakFlame active={streak.streakActive} size={112} />
            <p className="mt-1 text-5xl font-black tabular-nums tracking-tight text-white">
              {streak.streakCount}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-400/90">
              {streak.streakCount === 1 ? "day streak" : "days streak"}
            </p>
          </div>

          <div className="px-7 pb-7 pt-5">
            {choosing ? (
              <>
                <h2 className="mb-1 text-lg font-bold tracking-tight text-white">
                  How many words a day?
                </h2>
                <p className="mb-4 text-sm text-white/50">
                  Pick something you can hit on a bad day. You can always do more.
                </p>
                <DailyGoalPicker value={wordGoal} onChange={saveGoal} compact />
              </>
            ) : (
              <>
                <p className="text-center text-[15px] leading-relaxed text-white/70">
                  {done ? (
                    <>
                      Today&apos;s <b className="text-white">{wordGoal}</b> word
                      {wordGoal === 1 ? "" : "s"} are done. The fire is lit.
                    </>
                  ) : (
                    <>
                      <b className="text-white">{remaining}</b> more word
                      {remaining === 1 ? "" : "s"} today keeps it burning.
                    </>
                  )}
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setChoosing(true)}
                    className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 transition-colors hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                  >
                    Change goal
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      close();
                      navigate("/discover");
                    }}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#0f1714] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
                  >
                    {done ? "Keep going" : "Start watching"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
