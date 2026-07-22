import { useState, useEffect } from "react";
import { generateLinguaScript, createLinguaScriptFromSavedWord, type LinguaScript } from "@/lib/linguascripts";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Zap, Sparkles } from "lucide-react";

interface TodaysMissionProps {
  language: string;
  onStartExercise?: (script: LinguaScript) => void;
}

interface SavedWord {
  id: string;
  word: string;
  translation: string;
  context: string;
  state: string;
  next_review: string;
}

export function TodaysMission({ language, onStartExercise }: TodaysMissionProps) {
  const [scripts, setScripts] = useState<LinguaScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ completed: 0, total: 0, xpEarned: 0 });
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    loadMission();
  }, [language]);

  async function loadMission() {
    try {
      setLoading(true);
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Fetch saved words that need review today (red or orange state, with today's date or earlier)
      const today = new Date().toISOString().split("T")[0];
      const { data: savedWords, error: fetchError } = await supabase
        .from("saved_words")
        .select("id, word, translation, context, state, next_review")
        .eq("user_id", user.id)
        .eq("language", language)
        .in("state", ["red", "orange"])
        .lte("next_review", today)
        .order("next_review", { ascending: true })
        .limit(10);

      if (fetchError) {
        console.error("Failed to fetch saved words:", fetchError);
        return;
      }

      if (!savedWords || savedWords.length === 0) {
        setScripts([]);
        setStats({ completed: 0, total: 0, xpEarned: 0 });
        return;
      }

      // Generate LinguaScripts for each saved word
      const generatedScripts: LinguaScript[] = [];
      for (const savedWord of savedWords as SavedWord[]) {
        try {
          setGeneratingFor(savedWord.word);

          // Generate AI content
          const generated = await generateLinguaScript(
            savedWord.word,
            language,
            []
          );

          // Create LinguaScript in database
          const linguascriptId = await createLinguaScriptFromSavedWord(
            user.id,
            savedWord.id,
            savedWord.word,
            generated.translation,
            language,
            savedWord.context || generated.sentence,
            generated.gapOptions,
            generated.mcqOptions
          );

          generatedScripts.push({
            id: linguascriptId,
            user_id: user.id,
            language,
            target_word: savedWord.word,
            sentence: generated.sentence,
            translation: generated.translation,
            interest: "",
            gap_position: generated.gapPosition,
            gap_options: generated.gapOptions,
            mcq_options: generated.mcqOptions,
            status: "pending",
            attempts: 0,
            scheduled_to_srs: true,
            combo_multiplier: 1,
            created_at: new Date().toISOString(),
          } as LinguaScript);
        } catch (err) {
          console.error(`Failed to generate exercise for "${savedWord.word}":`, err);
        }
      }

      setGeneratingFor(null);
      setScripts(generatedScripts);
      setStats({
        completed: 0,
        total: generatedScripts.length,
        xpEarned: 0,
      });
    } catch (err) {
      console.error("Failed to load mission:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || generatingFor) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-slate-700 rounded w-3/4"></div>
              <div className="h-4 bg-slate-700 rounded w-1/2"></div>
            </div>
            {generatingFor && (
              <div className="mt-4 flex items-center gap-2 text-amber-400">
                <Sparkles className="w-4 h-4 animate-spin" />
                <span className="text-sm">Generating exercise for "{generatingFor}"...</span>
              </div>
            )}
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
                onClick={() => script.status !== "completed" && script.status !== "skipped" && onStartExercise?.(script)}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                  script.status === "completed"
                    ? "bg-emerald-500/10 border-emerald-500/40"
                    : script.status === "skipped"
                      ? "bg-slate-800 border-slate-700 opacity-60"
                      : "bg-slate-800/50 border-slate-700 hover:border-amber-500/50 hover:bg-slate-800"
                }`}
              >
                <div className="flex-1">
                  <p className="font-medium text-sm text-amber-300">
                    {script.target_word}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {script.sentence.substring(0, 50)}...
                  </p>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {script.status === "completed" ? (
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-400 text-sm font-bold">✓</span>
                      <span className="text-xs text-emerald-400 font-semibold">{script.xp_earned || 0}xp</span>
                    </div>
                  ) : script.status === "skipped" ? (
                    <span className="text-slate-500 text-xs">skipped</span>
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-700/50 hover:bg-amber-500/30 transition-all">
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">No vocabulary words to review today</p>
            <p className="text-xs text-slate-500 mt-2">Save words from videos to generate exercises</p>
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
