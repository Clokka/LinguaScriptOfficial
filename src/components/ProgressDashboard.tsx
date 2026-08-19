import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, BookOpen, Brain, Sparkles, Clock, TrendingUp, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStreakStatus } from "@/hooks/useStreakStatus";
import { StreakFlame } from "./StreakFlame";
import { MemoryStageCard } from "./MemoryStageCard";
import {
  stageCounts,
  retentionStrength,
  avgWordsPerDay,
  projectedYearlyVocab,
  watchTimeThisWeek,
  type SavedWordLite,
  type ActivityDayLite,
} from "@/lib/progressStats";
import { cn } from "@/lib/utils";

const AnimatedNumber = ({ value, suffix = "" }: { value: number; suffix?: string }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const start = display;
    const delta = value - start;
    const duration = 700;
    const t0 = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.round(start + delta * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <span className="tabular-nums">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
};

const StatCard = ({
  icon, label, value, sub, delay = 0, accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  delay?: number;
  accent?: "orange" | "indigo" | "emerald" | "rose";
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4, delay }}
    className="relative rounded-2xl border border-orange-100/80 bg-white/70 backdrop-blur-xl p-5 overflow-hidden"
  >
    <div
      className={cn(
        "absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-30",
        accent === "orange" && "bg-orange-400",
        accent === "indigo" && "bg-indigo-400",
        accent === "emerald" && "bg-emerald-400",
        accent === "rose" && "bg-rose-400",
        !accent && "bg-orange-300",
      )}
    />
    <div className="relative">
      <div className="flex items-center gap-2 text-neutral-500 mb-2">
        <span className="text-orange-500">{icon}</span>
        <p className="text-xs font-medium uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-bold tracking-tight text-neutral-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-neutral-500">{sub}</p>}
    </div>
  </motion.div>
);

interface ProgressDashboardProps {
  /** When embedded inside a dark surface, swap to a darker chrome. */
  variant?: "light" | "auto";
}

export const ProgressDashboard = ({ variant = "light" }: ProgressDashboardProps) => {
  const { user } = useAuth();
  const streak = useStreakStatus();

  const [words, setWords] = useState<SavedWordLite[]>([]);
  const [activity, setActivity] = useState<ActivityDayLite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    void (async () => {
      const thirty = new Date();
      thirty.setDate(thirty.getDate() - 30);
      const [w, a] = await Promise.all([
        supabase
          .from("saved_words")
          .select("review_count")
          .eq("user_id", user.id),
        supabase
          .from("activity_log")
          .select("date, minutes_watched, videos_watched, words_reviewed, goal_met")
          .eq("user_id", user.id)
          .gte("date", thirty.toISOString().split("T")[0])
          .order("date", { ascending: false }),
      ]);
      setWords((w.data as SavedWordLite[]) || []);
      setActivity((a.data as ActivityDayLite[]) || []);
      setLoading(false);
    })();
  }, [user]);

  const counts = stageCounts(words);
  const totalWords = words.length;
  const retention = retentionStrength(words);
  const avg = avgWordsPerDay(activity, 30);
  const projected = projectedYearlyVocab(avg);
  const weeklyMinutes = watchTimeThisWeek(activity);

  // Calendar grid (last 30 days)
  const days: { date: string; goalMet: boolean; active: boolean }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const a = activity.find((x) => x.date === dateStr);
    days.push({
      date: dateStr,
      goalMet: !!a?.goal_met,
      active: !!a && (a.minutes_watched > 0 || a.videos_watched > 0 || (a.words_reviewed ?? 0) > 0),
    });
  }

  const remainingWords = Math.max(0, streak.wordGoal - streak.wordsReviewed);
  const remainingMins = Math.max(0, streak.minuteGoal - streak.minutesWatched);

  return (
    <div className="space-y-6">
      {/* Streak hero — DOMINANT */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "relative overflow-hidden rounded-3xl border p-6 sm:p-10",
          streak.streakActive
            ? "border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 shadow-[0_30px_80px_-30px_rgba(249,115,22,0.55)]"
            : "border-neutral-200 bg-gradient-to-br from-neutral-50 to-white",
        )}
      >
        {/* Ambient heat orbs */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl transition-opacity",
            streak.streakActive ? "bg-orange-400/60 opacity-100" : "bg-neutral-300/40 opacity-70",
          )}
        />
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -bottom-24 -right-16 w-80 h-80 rounded-full blur-3xl transition-opacity",
            streak.streakActive ? "bg-indigo-400/40 opacity-100" : "bg-neutral-200/40 opacity-60",
          )}
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-stretch gap-6 sm:gap-8">
          {/* Lottie */}
          <div className="shrink-0 relative">
            <div
              className={cn(
                "absolute inset-0 rounded-full blur-2xl",
                streak.streakActive ? "bg-orange-400/50" : "bg-neutral-300/30",
              )}
            />
            <StreakFlame active={streak.streakActive} size={180} className="relative" />
          </div>

          {/* Right side */}
          <div className="flex-1 min-w-0 text-center sm:text-left">
            <p className={cn(
              "text-[11px] font-semibold uppercase tracking-[0.22em]",
              streak.streakActive ? "text-orange-600" : "text-neutral-500",
            )}>
              {streak.streakActive ? "Streak active" : "Today's mission"}
            </p>

            <div className="mt-2 flex items-baseline gap-3 justify-center sm:justify-start">
              <h2
                className={cn(
                  "font-black tracking-tight leading-none tabular-nums",
                  "text-[clamp(64px,14vw,140px)]",
                  streak.streakActive
                    ? "bg-gradient-to-br from-orange-500 via-amber-500 to-rose-500 bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(249,115,22,0.35)]"
                    : "text-neutral-300",
                )}
              >
                <AnimatedNumber value={streak.streakCount} />
              </h2>
              <span className={cn(
                "text-lg sm:text-2xl font-semibold",
                streak.streakActive ? "text-orange-700/80" : "text-neutral-400",
              )}>
                day{streak.streakCount === 1 ? "" : "s"}
              </span>
            </div>

            {!streak.streakActive ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm sm:text-base text-neutral-700 leading-relaxed max-w-md mx-auto sm:mx-0">
                  Hit your word goal to ignite today&apos;s streak.
                </p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Pill done={streak.wordsGoalMet}>
                    {streak.wordsGoalMet
                      ? `${streak.wordGoal} word${streak.wordGoal === 1 ? "" : "s"} reviewed`
                      : `${remainingWords} more word${remainingWords === 1 ? "" : "s"} to review`}
                  </Pill>
                  {/* Watch time is a bonus, so it reads as one — the streak does
                      not wait on it and the copy must not imply that it does. */}
                  <Pill done={streak.watchGoalMet}>
                    {streak.watchGoalMet
                      ? `${streak.minuteGoal} min watched \u2014 bonus`
                      : `bonus: ${remainingMins} more min to watch`}
                  </Pill>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm sm:text-base text-orange-700 font-medium">
                🔥 Today's mission complete. Keep the fire alive tomorrow.
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Top stat grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <StatCard
          icon={<Flame className="w-4 h-4" />}
          label="Current Streak"
          value={<AnimatedNumber value={streak.streakCount} />}
          sub="days in a row"
          delay={0.05}
          accent="orange"
        />
        <StatCard
          icon={<BookOpen className="w-4 h-4" />}
          label="Total Words"
          value={<AnimatedNumber value={totalWords} />}
          sub="saved from videos"
          delay={0.1}
          accent="indigo"
        />
        <StatCard
          icon={<TrendingUp className="w-4 h-4" />}
          label="Avg Words / Day"
          value={<span className="tabular-nums">{avg.toFixed(1)}</span>}
          sub="last 30 days"
          delay={0.15}
          accent="emerald"
        />
        <StatCard
          icon={<Target className="w-4 h-4" />}
          label="Projected / Year"
          value={<AnimatedNumber value={projected} />}
          sub="at current pace"
          delay={0.2}
          accent="orange"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Watch This Week"
          value={<AnimatedNumber value={weeklyMinutes} suffix=" min" />}
          sub="comprehensible input"
          delay={0.25}
          accent="indigo"
        />
        <StatCard
          icon={<Brain className="w-4 h-4" />}
          label="Retention"
          value={<AnimatedNumber value={retention} suffix="%" />}
          sub="medium + long-term"
          delay={0.3}
          accent="emerald"
        />
      </div>

      {/* Memory stages */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-lg font-semibold text-neutral-900">Reviewed Words</h3>
          <p className="text-xs text-neutral-500">
            <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1 text-orange-500" />
            Spaced-repetition memory stages
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <MemoryStageCard stage="short" count={counts.short} total={totalWords} delay={0.05} />
          <MemoryStageCard stage="medium" count={counts.medium} total={totalWords} delay={0.1} />
          <MemoryStageCard stage="long" count={counts.long} total={totalWords} delay={0.15} />
        </div>
      </div>

      {/* Activity calendar */}
      <div className="rounded-2xl border border-orange-100/80 bg-white/70 backdrop-blur-xl p-5 sm:p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-lg font-semibold text-neutral-900">Last 30 Days</h3>
          <div className="flex items-center gap-3 text-[11px] text-neutral-500">
            <Legend color="bg-emerald-500" label="Streak" />
            <Legend color="bg-amber-400/70" label="Active" />
            <Legend color="bg-neutral-200" label="None" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <div key={i} className="text-[10px] text-neutral-400 text-center">{d}</div>
          ))}
          {(() => {
            const first = new Date(days[0].date);
            const dow = (first.getDay() + 6) % 7;
            return Array.from({ length: dow }).map((_, i) => <div key={`pad-${i}`} />);
          })()}
          {days.map((d) => (
            <div
              key={d.date}
              title={d.date}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center text-[10px] font-medium",
                d.goalMet
                  ? "bg-emerald-500 text-white"
                  : d.active
                  ? "bg-amber-400/70 text-white"
                  : "bg-neutral-100 text-neutral-400",
              )}
            >
              {new Date(d.date).getDate()}
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <p className="text-xs text-neutral-400 text-center">Loading your data…</p>
      )}
    </div>
  );
};

const Pill = ({ children, done }: { children: React.ReactNode; done: boolean }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1 border",
      done
        ? "bg-emerald-50 border-emerald-200 text-emerald-700"
        : "bg-neutral-50 border-neutral-200 text-neutral-600",
    )}
  >
    <span
      className={cn("w-1.5 h-1.5 rounded-full", done ? "bg-emerald-500" : "bg-neutral-300")}
    />
    {children}
  </span>
);

const Legend = ({ color, label }: { color: string; label: string }) => (
  <span className="inline-flex items-center gap-1">
    <span className={cn("w-2 h-2 rounded-sm", color)} />
    {label}
  </span>
);
