import { useEffect, useState } from "react";
import { Flame, Clock, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

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
        .gte("date", thirty.toISOString().split("T")[0])
        .order("date", { ascending: false });
      const rows = (data as ActivityDay[]) || [];
      setActivity(rows);

      // streak calc (same as Browse.tsx)
      const dates = new Set(rows.map((d) => d.date));
      const today = new Date();
      let s = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const ds = d.toISOString().split("T")[0];
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
  const cells: { date: string; active: boolean; inFuture: boolean }[] = [];
  for (let i = 34; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    const a = activity.find((x) => x.date === ds);
    cells.push({
      date: ds,
      active: !!a && ((a.minutes_watched || 0) > 0 || (a.videos_watched || 0) > 0),
      inFuture: d > today,
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-1">Activity Calendar</h2>
        <p className="text-muted-foreground">Track your daily learning progress.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile
          icon={<Flame className="w-7 h-7" />}
          value={streak}
          label="Day Streak"
          color="text-orange-400"
          ring="ring-orange-500/20"
        />
        <StatTile
          icon={<Clock className="w-7 h-7" />}
          value={totalMinutes}
          label="Minutes Watched"
          color="text-primary"
          ring="ring-primary/20"
        />
        <StatTile
          icon={<Play className="w-7 h-7 fill-current" />}
          value={totalVideos}
          label="Videos Watched"
          color="text-emerald-400"
          ring="ring-emerald-500/20"
        />
      </div>

      {/* Last 30 days grid */}
      <div>
        <h3 className="text-xl font-semibold text-foreground mb-5">Last 30 Days</h3>
        <div className="grid grid-cols-7 gap-2 sm:gap-3">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="text-xs sm:text-sm font-medium text-muted-foreground text-center pb-2">
              {d}
            </div>
          ))}
          {cells.map((c) => {
            const day = new Date(c.date).getDate();
            return (
              <div
                key={c.date}
                title={c.date}
                className={cn(
                  "aspect-square rounded-xl flex items-center justify-center text-sm transition-colors",
                  c.inFuture
                    ? "bg-secondary/20 text-muted-foreground/30"
                    : c.active
                      ? "bg-primary/25 ring-1 ring-primary/40 text-foreground font-semibold"
                      : "bg-secondary/40 text-muted-foreground/70",
                )}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatTile = ({
  icon, value, label, color, ring,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: string;
  ring: string;
}) => (
  <div className={cn("glass-panel rounded-2xl p-6 sm:p-8 text-center ring-1", ring)}>
    <div className={cn("mb-3 flex justify-center", color)}>{icon}</div>
    <p className="text-4xl sm:text-5xl font-bold text-foreground tabular-nums">{value}</p>
    <p className="text-sm text-muted-foreground mt-1">{label}</p>
  </div>
);
