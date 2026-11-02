// "Your Progress" aggregate dashboard for the Home tab — every stat
// updates automatically from watch_sessions / video_comprehension.
import { useEffect, useState } from "react";
import { Trophy, TrendingUp, Target, Clock, BookOpen, PlayCircle, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { fetchProgressStats, fetchLearningRate, type DashboardStats } from "@/lib/watchSessions";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { cn } from "@/lib/utils";
import { GlassCard, CountUp, ACCENT, Eyebrow, type Accent } from "@/components/premium";

export function YourProgressDashboard({ languages }: { languages?: string[] }) {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rates, setRates] = useState<{ lang: string; rate: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    // Scoped to the active language — each language profile keeps its own numbers.
    fetchProgressStats(learningLanguage).then((s) => { if (alive) setStats(s); });
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
        <Card icon={TrendingUp} label="Average comprehension" value={Math.round(stats.avg_comprehension)} suffix="%" accent="green" />
        <Card icon={Trophy} label="Best video" value={Math.round(stats.highest_comprehension)} suffix="%" accent="gold" />
        <Card icon={Target} label="Avg gain / watch" value={stats.avg_gain_per_watch} prefix={stats.avg_gain_per_watch > 0 ? "+" : ""} suffix="%" accent="blue" />
        <Card icon={CheckCircle2} label="Videos mastered" value={stats.videos_mastered} accent="green" />
        <Card icon={PlayCircle} label="In progress" value={stats.videos_in_progress} accent="blue" />
        <Card icon={Clock} label="Hours of input" value={Number(hours)} decimals={stats.total_minutes < 600 ? 1 : 0} suffix="h" accent="gold" />
        <Card icon={BookOpen} label="Vocabulary learned" value={stats.vocab_learned} accent="green" />
        {rates.length > 0 && (
          <GlassCard className="p-4 col-span-2 md:col-span-1">
            <Eyebrow className="mb-2 text-[10px]">Learning rate · 7d</Eyebrow>
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
          </GlassCard>
        )}
      </div>
    </section>
  );
}

function Card({ icon: Icon, label, value, prefix = "", suffix = "", decimals = 0, accent }: {
  icon: any; label: string; value: number; prefix?: string; suffix?: string; decimals?: number; accent: Accent;
}) {
  const hsl = ACCENT[accent];
  return (
    <GlassCard accent={accent} className="overflow-hidden p-4">
      <div
        className="mb-3 inline-grid h-9 w-9 place-items-center rounded-xl"
        style={{ background: `hsl(${hsl} / 0.14)`, color: `hsl(${hsl})`, boxShadow: `0 0 22px -6px hsl(${hsl} / 0.8)` }}
      >
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-3xl font-black tracking-tight text-foreground">
        {prefix}<CountUp value={value} format={(n) => n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} />{suffix}
      </p>
      <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{label}</p>
    </GlassCard>
  );
}
