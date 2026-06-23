import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStreakStatus } from "@/hooks/useStreakStatus";
import { StreakLottie } from "./StreakLottie";
import { DailyGoalPicker } from "./DailyGoalPicker";
import { wordGoalForVideos } from "@/lib/progressStats";

const dismissKey = (uid: string) => `briefing:${uid}:${new Date().toISOString().split("T")[0]}`;

/**
 * Persistent "daily mission briefing" modal. Shows once per day for any
 * onboarded user whose profile.show_daily_briefing is true.
 */
export const DailyBriefing = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [videoGoal, setVideoGoal] = useState(1);
  const [profileChecked, setProfileChecked] = useState(false);
  const streak = useStreakStatus();

  // Decide whether to show
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarded, show_daily_briefing, daily_video_goal")
        .eq("user_id", user.id)
        .single();
      if (cancelled) return;
      const p: any = data || {};
      setVideoGoal(p.daily_video_goal ?? 1);
      setProfileChecked(true);
      const dismissed = typeof window !== "undefined" && localStorage.getItem(dismissKey(user.id)) === "1";
      if (p.onboarded && p.show_daily_briefing && !dismissed) {
        setOpen(true);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  const close = () => {
    if (user) localStorage.setItem(dismissKey(user.id), "1");
    setOpen(false);
  };

  const saveGoal = async (videos: number) => {
    setVideoGoal(videos);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        daily_video_goal: videos,
        daily_word_goal: wordGoalForVideos(videos),
      } as any)
      .eq("user_id", user.id);
    void streak.refresh();
  };

  if (!open || !profileChecked) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="bg"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={close}
      >
        <motion.div
          key="panel"
          initial={{ opacity: 0, scale: 0.96, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 16 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg rounded-3xl bg-white shadow-2xl border border-orange-100 overflow-hidden"
        >
          <button
            onClick={close}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-500"
          >
            <X className="w-4 h-4" />
          </button>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="0"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-7 sm:p-9"
              >
                <div className="flex items-center gap-4 mb-4">
                  <StreakLottie active={streak.streakActive} size={72} />
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-orange-600">
                      Welcome back
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                      {streak.streakCount > 0
                        ? `${streak.streakCount}-day streak`
                        : "Let's start your streak"}
                    </h2>
                  </div>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Consistency is the single biggest predictor of fluency. A few minutes of comprehensible
                  input every day compounds into thousands of new words over the year.
                </p>
                <div className="mt-6 flex items-start gap-2 rounded-2xl bg-orange-50/60 border border-orange-100 p-4 text-sm text-neutral-700">
                  <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
                  <p>
                    Yesterday you watched <b>{streak.minutesWatched}</b> min and reviewed{" "}
                    <b>{streak.wordsReviewed}</b> words. Let's make today count.
                  </p>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="1"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-7 sm:p-9"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-orange-600 mb-1.5">
                  Today's mission
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900 mb-4">
                  Choose your daily input goal
                </h2>
                <DailyGoalPicker value={videoGoal} onChange={saveGoal} compact />
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="2"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="p-7 sm:p-9 text-center"
              >
                <div className="mx-auto mb-4">
                  <StreakLottie active size={120} />
                </div>
                <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">
                  Go earn today's streak
                </h2>
                <p className="mt-2 text-sm text-neutral-600 leading-relaxed">
                  Review <b>{wordGoalForVideos(videoGoal)}</b> words and watch{" "}
                  <b>{videoGoal * 10}</b> minutes of French to light the fire.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3 px-7 sm:px-9 pb-7 sm:pb-9">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === step ? "w-6 bg-orange-500" : "w-1.5 bg-orange-200"
                  }`}
                />
              ))}
            </div>
            <Button
              onClick={() => {
                if (step < 2) setStep(step + 1);
                else {
                  close();
                  navigate("/browse");
                }
              }}
              className="rounded-full bg-orange-500 hover:bg-orange-600 text-white gap-2"
            >
              {step < 2 ? "Continue" : "Start learning"}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
