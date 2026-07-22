import { useState, useEffect } from "react";
import {
  getWordsNeedingReview,
  createLinguaScriptFromSavedWord,
  generateLinguaScript,
  type LinguaScript
} from "@/lib/linguascripts";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, Zap, Target, Sparkles } from "lucide-react";

interface TodaysMissionProps {
  language: string;
  onStartExercise?: (script: LinguaScript) => void;
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

      // Get saved words needing review
      const wordsNeedingReview = await getWordsNeedingReview(user.id, language, 10);

      if (wordsNeedingReview.length === 0) {
        // No saved words yet, show sample exercises
        const { data } = await supabase
          .from("linguascripts")
          .select("*")
          .eq("user_id", user.id)
          .eq("language", language)
          .order("created_at", { ascending: false })
          .limit(5);

        if (data) {
          setScripts(data as LinguaScript[]);
          calculateStats(data as LinguaScript[]);
        }
        return;
      }

      // Generate LinguaScripts for words needing review
      const generatedScripts: LinguaScript[] = [];

      for (const savedWord of wordsNeedingReview) {
        try {
          setGeneratingFor(savedWord.word);

          // Generate AI content for the word
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
          console.error(`Failed to generate LinguaScript for "${savedWord.word}":`, err);
        }
      }

      setGeneratingFor(null);
      setScripts(generatedScripts);
      calculateStats(generatedScripts);
    } catch (err) {
      console.error("Failed to load mission:", err);
    } finally {
      setLoading(false);
    }
  }

  function calculateStats(scripts: LinguaScript[]) {
    const completed = scripts.filter(s => s.status === "completed").length;
    const xpEarned = scripts.reduce((sum, s) => sum + (s.xp_earned || 0), 0);
    setStats({ completed, total: scripts.length, xpEarned });
  }

  if (loading || generatingFor) {
    return (
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-3/4"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
          {generatingFor && (
            <div className="mt-4 flex items-center gap-2 text-amber-400">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span className="text-sm">Generating exercise for "{generatingFor}"...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const completionPercent = stats.total > 0 ? (stats.completed / stats.total) * 100 : 0;
  const nextIncomplete = scripts.find(s => s.status !== "completed" && s.status !== "skipped");

  return (
    <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-amber-500/30 to-emerald-500/30 rounded-lg">
            <Target className="w-6 h-6 text-amber-400" style={{ filter: "drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))" }} />
          </div>
          <div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-amber-300 to-emerald-300 bg-clip-text text-transparent">Today's Mission</h2>
            <p className="text-sm text-slate-400 mt-1">Review {stats.total} vocabulary words</p>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <p className="text-3xl font-black text-amber-400">{stats.xpEarned}</p>
          </div>
          <p className="text-xs text-slate-500 font-medium">XP earned</p>
        </div>
      </div>

      {/* Progress Circle */}
      <div className="mb-8">
        <div className="relative w-24 h-24 mx-auto mb-4">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(71, 85, 105, 0.3)" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="8"
              strokeDasharray={`${(completionPercent / 100) * 2 * Math.PI * 45} ${2 * Math.PI * 45}`}
              strokeLinecap="round"
              className="transition-all duration-500"
              style={{ filter: "drop-shadow(0 0 8px rgba(251, 191, 36, 0.4))" }}
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex items-center justify-center flex-col">
            <p className="text-2xl font-black text-amber-400">{stats.completed}</p>
            <p className="text-xs text-slate-500">of {stats.total}</p>
          </div>
        </div>
      </div>

      {/* Exercise List */}
      {scripts.length > 0 ? (
        <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
          {scripts.map((script) => (
            <div
              key={script.id}
              onClick={() => script.status !== "completed" && script.status !== "skipped" && onStartExercise?.(script)}
              className={`flex items-center justify-between p-4 rounded-lg border transition-all cursor-pointer group ${
                script.status === "completed"
                  ? "bg-emerald-500/10 border-emerald-500/40"
                  : script.status === "skipped"
                    ? "bg-slate-800 border-slate-700 opacity-60"
                    : "bg-slate-800/50 border-slate-700 hover:border-amber-500/50 hover:bg-slate-800"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-amber-300">{script.target_word}</p>
                <p className="text-xs text-slate-400 truncate">{script.sentence.substring(0, 50)}...</p>
              </div>

              <div className="flex items-center gap-3 ml-4">
                {script.status === "completed" ? (
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-400 text-sm font-bold">✓</span>
                    <span className="text-xs text-emerald-400 font-semibold">{script.xp_earned}xp</span>
                  </div>
                ) : script.status === "skipped" ? (
                  <span className="text-slate-500 text-xs">skipped</span>
                ) : (
                  <div className="p-2 rounded-lg bg-slate-700/50 group-hover:bg-amber-500/30 transition-all">
                    <ArrowRight className="w-4 h-4 text-amber-400 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 mb-6">
          <p className="text-slate-400 text-sm">No exercises for today</p>
          <p className="text-xs text-slate-500 mt-2">Save words in your vocabulary to generate exercises</p>
        </div>
      )}

      {/* Continue Button */}
      {nextIncomplete && (
        <button
          onClick={() => onStartExercise?.(nextIncomplete)}
          className="w-full py-3 bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold rounded-lg hover:shadow-xl hover:shadow-amber-500/30 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
        >
          <span>Continue Mission</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {stats.completed === stats.total && stats.total > 0 && (
        <div className="mt-4 bg-gradient-to-r from-emerald-500/20 to-amber-500/20 border border-emerald-500/40 rounded-lg p-4 text-center">
          <p className="text-emerald-400 font-bold text-sm">🎉 You completed today's mission!</p>
          <p className="text-xs text-slate-400 mt-1">Come back tomorrow for new challenges</p>
        </div>
      )}
    </div>
  );
}
