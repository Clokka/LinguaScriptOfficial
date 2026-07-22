import { useState, useEffect } from "react";
import { getDailyLinguascripts, type LinguaScript } from "@/lib/linguascripts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Zap } from "lucide-react";

interface TodaysMissionProps {
  language: string;
  onStartExercise?: (script: LinguaScript) => void;
}

export function TodaysMission({ language, onStartExercise }: TodaysMissionProps) {
  const [scripts, setScripts] = useState<LinguaScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ completed: 0, total: 0, xpEarned: 0 });

  useEffect(() => {
    loadMission();
  }, [language]);

  async function loadMission() {
    try {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const dailyScripts = await getDailyLinguascripts(user.id, language);
      setScripts(dailyScripts);

      const completed = dailyScripts.filter(
        (s) => s.status === "completed"
      ).length;
      const xpEarned = dailyScripts.reduce(
        (sum, s) => sum + (s.xp_earned || 0),
        0
      );

      setStats({
        completed,
        total: dailyScripts.length,
        xpEarned,
      });
    } catch (err) {
      console.error("Failed to load mission:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const completionPercent =
    stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const nextIncomplete = scripts.find(
    (s) => s.status !== "completed" && s.status !== "skipped"
  );

  return (
    <Card className="bg-slate-900 border-emerald-500/30">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-emerald-500" />
              Today's Mission
            </CardTitle>
            <CardDescription>
              Learn {stats.total} new vocabulary words
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-emerald-500">
              {stats.xpEarned}
            </p>
            <p className="text-xs text-slate-400">XP earned</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-400">Progress</span>
            <span className="font-semibold">
              {stats.completed} of {stats.total}
            </span>
          </div>
          <Progress value={completionPercent} className="h-2" />
        </div>

        {/* Mission list */}
        {scripts.length > 0 ? (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {scripts.map((script) => (
              <div
                key={script.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  script.status === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : script.status === "skipped"
                      ? "bg-slate-800 border-slate-700 opacity-60"
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">
                    {script.target_word}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {script.sentence.substring(0, 40)}...
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {script.status === "completed" ? (
                    <span className="text-emerald-500 text-sm font-semibold">✓</span>
                  ) : script.status === "skipped" ? (
                    <span className="text-slate-500 text-sm">skipped</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onStartExercise?.(script)}
                      className="h-7 w-7 p-0"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No exercises for today yet</p>
          </div>
        )}

        {/* Next exercise button */}
        {nextIncomplete && (
          <Button
            onClick={() => onStartExercise?.(nextIncomplete)}
            className="w-full bg-emerald-600 hover:bg-emerald-700"
          >
            Continue Mission
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}

        {stats.completed === stats.total && stats.total > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-lg p-4 text-center">
            <p className="text-emerald-500 font-semibold">
              🎉 You completed today's mission!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
