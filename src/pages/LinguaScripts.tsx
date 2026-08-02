import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, BookOpen, Loader2 } from "lucide-react";

type WordState = "red" | "orange" | "green";

interface LinguaScript {
  id: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: WordState;
  completed_at?: string;
  scheduled_for?: string;
}

const STATE_CONFIG: Record<WordState, { label: string; emoji: string; description: string; color: string }> = {
  green: {
    label: "Review",
    emoji: "🟢",
    description: "Words you know well",
    color: "emerald",
  },
  orange: {
    label: "Learn",
    emoji: "🟠",
    description: "Strengthening words",
    color: "amber",
  },
  red: {
    label: "Master",
    emoji: "🔴",
    description: "New words to learn",
    color: "red",
  },
};

export default function LinguaScripts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();

  const [allExercises, setAllExercises] = useState<LinguaScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    if (user && learningLanguage) {
      fetchExercises();
    }
  }, [user, learningLanguage]);

  const fetchExercises = useCallback(async () => {
    if (!user || !learningLanguage) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("linguascripts")
        .select("*")
        .eq("user_id", user.id)
        .eq("language", learningLanguage)
        .order("word_state", { ascending: false })
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      setAllExercises(data || []);

      const now = new Date().toISOString();
      const due = (data || []).filter(
        (e) => e.scheduled_for && e.scheduled_for <= now && !e.completed_at
      ).length;
      setDueCount(due);
    } catch (err) {
      console.error("Error loading exercises:", err);
    } finally {
      setLoading(false);
    }
  }, [user, learningLanguage]);

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400">Please log in</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
          <p className="text-slate-400">Loading exercises...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
      {/* Header */}
      <div className="border-b border-slate-800">
        <div className="container mx-auto px-4 py-6 flex items-center gap-4">
          <button
            onClick={() => navigate("/discover")}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-slate-400" />
          </button>
          <div>
            <h1 className="text-3xl font-black text-amber-400">LinguaScripts</h1>
            <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">SRS Practice</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
            <div className="text-3xl font-bold text-amber-400">{dueCount}</div>
            <div className="text-sm text-slate-400 mt-1">Due today</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
            <div className="text-3xl font-bold text-emerald-400">{allExercises.length}</div>
            <div className="text-sm text-slate-400 mt-1">Total exercises</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
            <div className="text-3xl font-bold text-blue-400">
              {allExercises.filter((e) => e.completed_at).length}
            </div>
            <div className="text-sm text-slate-400 mt-1">Completed</div>
          </div>
        </div>

        {/* Exercise Groups */}
        {["green", "orange", "red"].map((state) => {
          const stateExercises = allExercises.filter((e) => e.word_state === state);
          if (stateExercises.length === 0) return null;

          const config = STATE_CONFIG[state as WordState];

          return (
            <div key={state} className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{config.emoji}</span>
                <div>
                  <h2 className="text-xl font-bold text-slate-200">{config.label}</h2>
                  <p className="text-sm text-slate-500">{config.description}</p>
                </div>
                <span className="ml-auto text-sm font-bold text-slate-400">
                  {stateExercises.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stateExercises.map((exercise) => (
                  <div
                    key={exercise.id}
                    className="bg-slate-800 hover:bg-slate-700 rounded-lg p-4 cursor-pointer transition-all border border-slate-700 hover:border-slate-600"
                  >
                    <p className="font-bold text-lg mb-2 text-slate-100">{exercise.target_word}</p>
                    <p className="text-sm text-slate-400 italic mb-3 line-clamp-2">
                      "{exercise.sentence}"
                    </p>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        {exercise.completed_at ? "✅ Completed" : "⏱️ Pending"}
                      </span>
                      <span className="text-amber-400">Practice →</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {allExercises.length === 0 && !loading && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 mx-auto mb-4 text-slate-600" />
            <p className="text-slate-400">No exercises yet. Save words while watching to get started!</p>
            <button
              onClick={() => navigate("/discover")}
              className="mt-4 px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-colors"
            >
              Browse Videos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
