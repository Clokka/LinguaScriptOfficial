import { useEffect, useState } from "react";
import { Target, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDailyWordGoal } from "@/hooks/useDailyWordGoal";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { getLanguageLabel } from "@/lib/languages";
import { cn } from "@/lib/utils";

const OPTIONS = [1, 3, 5, 10, 15, 20, 30, 40];

/** Settings card: change the daily word goal for the active language. */
export const DailyWordGoalSetting = () => {
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();
  const lang = (learningLanguage || "").toLowerCase();
  const { goal, loading, refresh } = useDailyWordGoal(lang || undefined);
  const { toast } = useToast();
  const [value, setValue] = useState(goal);
  const [saving, setSaving] = useState(false);

  useEffect(() => setValue(goal), [goal]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const updates: any[] = [
      supabase.from("profiles").update({ daily_word_goal: value } as any).eq("user_id", user.id),
    ];
    if (lang) {
      updates.push(
        (supabase as any)
          .from("language_profiles")
          .update({ daily_word_goal: value })
          .eq("user_id", user.id)
          .eq("language", lang),
      );
    }
    const results = await Promise.all(updates);
    setSaving(false);
    if (results.some((r) => r.error)) {
      toast({ title: "Couldn't save your goal", variant: "destructive" });
      return;
    }
    await refresh();
    toast({ title: `Daily goal set to ${value} word${value === 1 ? "" : "s"}` });
  };

  return (
    <div className="glass-panel p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Target className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">Daily word goal</h2>
          <p className="text-xs text-muted-foreground">
            How many new words you aim to save each day
            {lang ? ` in ${getLanguageLabel(lang)}` : ""}.
          </p>
        </div>
      </div>
      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2">
            {OPTIONS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setValue(n)}
                aria-pressed={value === n}
                className={cn(
                  "rounded-xl border py-2 text-sm font-semibold transition-colors",
                  value === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:border-primary/50",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <Button onClick={save} disabled={saving || value === goal} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save goal"}
          </Button>
        </>
      )}
    </div>
  );
};
