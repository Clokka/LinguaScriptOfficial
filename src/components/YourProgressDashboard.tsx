// "Your Progress" aggregate dashboard for the Home tab — every stat
// updates automatically from watch_sessions / video_comprehension.
import { useEffect, useState } from "react";
import { Trophy, TrendingUp, Target, Clock, BookOpen, PlayCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchProgressStats, fetchLearningRate, type DashboardStats } from "@/lib/watchSessions";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { cn } from "@/lib/utils";

export function YourProgressDashboard({ languages }: { languages?: string[] }) {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rates, setRates] = useState<{ lang: string; rate: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    fetchProgressStats().then((s) => { if (alive) setStats(s); });
    const langs = languages && languages.length ? languages : [learningLanguage];
    Promise.all(langs.map(async (l) => ({ lang: l, rate: await fetchLearningRate(l) })))
      .then((r) => { if (alive) setRates(r); });
    return () => { alive = false; };
  }, [user, learningLanguage, languages]);

  if (!user || !stats) return null;
  // Show nothing until the learner actually has data.
  const empty = stats.videos_mastered + stats.videos_in_progress === 0;
  if (empty) return null;

  const hours = (stats.total_minutes / 60).toFixed(stats.total_minutes < 600 ? 1 : 0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" /> Your Progress
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          A live snapshot of your comprehensible-input journey.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card icon={TrendingUp} label="Average comprehension" value={`${Math.round(stats.avg_comprehension)}%`} tint="emerald" />
        <Card icon={Trophy} label="Best video" value={`${Math.round(stats.highest_comprehension)}%`} tint="amber" />
        <Card icon={Target} label="Avg gain / watch" value={`${stats.avg_gain_per_watch > 0 ? "+" : ""}${stats.avg_gain_per_watch}%`} tint="primary" />
        <Card icon={CheckCircle2} label="Videos mastered" value={stats.videos_mastered.toLocaleString()} tint="emerald" />
        <Card icon={PlayCircle} label="In progress" value={stats.videos_in_progress.toLocaleString()} tint="primary" />
        <Card icon={Clock} label="Hours of input" value={`${hours}h`} tint="amber" />
        <Card icon={BookOpen} label="Vocabulary learned" value={stats.vocab_learned.toLocaleString()} tint="emerald" />
        {rates.length > 0 && (
          <div className="glass-panel-strong rounded-2xl p-4 col-span-2 md:col-span-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Learning rate · 7d</p>
            <div className="space-y-1.5">
              {rates.map((r) => (
                <div key={r.lang} className="flex items-center justify-between text-xs">
                  <span className="text-foreground/90">
                    {getLanguageFlag(r.lang)} {getLanguageLabel(r.lang)}
                  </span>
                  <span className={cn(
                    "font-semibold tabular-nums",
                    r.rate > 0 ? "text-emerald-300" : r.rate < 0 ? "text-rose-300" : "text-muted-foreground"
                  )}>
                    {r.rate > 0 ? "+" : ""}{r.rate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Card({ icon: Icon, label, value, tint }: { icon: any; label: string; value: string; tint: "emerald" | "amber" | "primary" }) {
  const tints = {
    emerald: "text-emerald-400 from-emerald-500/10",
    amber:   "text-amber-300 from-amber-500/10",
    primary: "text-primary from-primary/10",
  } as const;
  return (
    <div className={cn("glass-panel-strong rounded-2xl p-4 relative overflow-hidden bg-gradient-to-br to-transparent", tints[tint])}>
      <Icon className={cn("w-4 h-4 mb-2", tints[tint])} />
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{label}</p>
    </div>
  );
}
