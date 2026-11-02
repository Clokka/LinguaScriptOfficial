import { useEffect, useState } from "react";
import { Flame, Clock, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { mergeActivityByDate } from "@/lib/activityLog";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { StatTile as GlowStat } from "@/components/premium";

// Local YYYY-MM-DD (toISOString is UTC, which put days in the wrong cell
// for learners west of London late in the evening).
const localKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

interface ActivityDay {
  date: string;
  minutes_watched: number;
  videos_watched: number;
}

/**
 * Dark-themed Activity Calendar — restores the brand palette shown in the
 * legacy reference screenshot (deep navy surfaces, indigo/orange/green
 * accents, full day-name column headers). Pure visual; no logic changes.
 */
export const ActivityCalendarDark = () => {
  const { user } = useAuth();
  const [activity, setActivity] = useState<ActivityDay[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const thirty = new Date();
      thirty.setDate(thirty.getDate() - 30);
      const { data } = await supabase
        .from("activity_log")
        .select("date, minutes_watched, videos_watched")
        .eq("user_id", user.id)
        .gte("date", localKey(thirty))
        .order("date", { ascending: false });
      // One entry per day across languages (rows are per language).
      const rows = mergeActivityByDate((data as ActivityDay[]) || []);
      setActivity(rows);

      // streak calc (same as Browse.tsx)
      const dates = new Set(rows.map((d) => d.date));
      const today = new Date();
      let s = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = localKey(d);
        if (dates.has(ds)) s++;
        else if (i > 0) break;
      }
      setStreak(s);
    })();
  }, [user]);

  const totalMinutes = activity.reduce((s, a) => s + (a.minutes_watched || 0), 0);
  const totalVideos = activity.reduce((s, a) => s + (a.videos_watched || 0), 0);

  // Build a 5-row × 7-col grid (Mon-first), last 35 days ending today.
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // 0=Mon
  const end = new Date(today);
  // jump to the Sunday at the end of the current week
  end.setDate(end.getDate() + (6 - dow));
  const cells: { date: string; active: boolean; inFuture: boolean; isToday: boolean; day: number }[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const ds = localKey(d);
    const a = activity.find((x) => x.date === ds);
    cells.push({
      date: ds,
      active: !!a && ((a.minutes_watched || 0) > 0 || (a.videos_watched || 0) > 0),
      inFuture: d > today,
      isToday: ds === localKey(today),
      day: d.getDate(),
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-1">Activity Calendar</h2>
        <p className="text-muted-foreground">Track your daily learning progress.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <GlowStat icon={<Flame className="w-5 h-5" />} value={streak} label="Day streak" accent="orange" className="p-3.5 sm:p-5" />
        <GlowStat icon={<Clock className="w-5 h-5" />} value={totalMinutes} label="Minutes · 30 days" accent="green" className="p-3.5 sm:p-5" />
        <GlowStat icon={<Play className="w-5 h-5 fill-current" />} value={totalVideos} label="Videos · 30 days" accent="blue" className="p-3.5 sm:p-5" />
      </div>

      {/* Last 30 days grid */}
      <div className="ls-glass p-4 sm:p-6">
        <h3 className="text-lg font-bold text-foreground mb-4">Last 30 days</h3>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center pb-1">
              {d.slice(0, 1)}<span className="hidden sm:inline">{d.slice(1)}</span>
            </div>
          ))}
          {cells.map((c, i) => (
            <div
              key={c.date}
              title={c.date}
              className={cn(
                "aspect-square min-w-0 rounded-xl flex items-center justify-center text-xs sm:text-sm transition-all duration-500",
                c.inFuture
                  ? "bg-white/[0.02] text-muted-foreground/30"
                  : c.active
                    ? "bg-gradient-to-br from-[#34C759] to-[#1a8f3e] text-white font-bold shadow-[0_0_18px_-4px_#34C759]"
                    : "bg-white/[0.04] text-muted-foreground/70",
                c.isToday && "ring-2 ring-amber-300/80 ring-offset-2 ring-offset-background",
              )}
              style={{ transitionDelay: `${i * 12}ms` }}
            >
              {c.day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
