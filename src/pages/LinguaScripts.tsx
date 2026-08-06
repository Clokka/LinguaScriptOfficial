import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowLeft, BookOpen, Loader2, Play } from "lucide-react";
import { LinguaScriptSession } from "@/components/LinguaScriptSession";

type WordState = "red" | "orange" | "green";

interface Exercise {
  id: string;
  target_word: string;
  sentence: string;
  translation: string;
  word_state: WordState;
  completed_at?: string;
  scheduled_for?: string;
}

const STATE_CONFIG: Record<WordState, { label: string; emoji: string; description: string }> = {
  green: { label: "Review", emoji: "🟢", description: "Words you know well" },
  orange: { label: "Learn", emoji: "🟠", description: "Strengthening words" },
  red: { label: "Master", emoji: "🔴", description: "New words to learn" },
};

export default function LinguaScripts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [dueCount, setDueCount] = useState(0);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionExerciseIds, setSessionExerciseIds] = useState<string[]>([]);

  useEffect(() => {
    if (user && learningLanguage) {
      loadExercises();
    }
  }, [user, learningLanguage]);

  const loadExercises = useCallback(async () => {
    if (!user || !learningLanguage) return;

    try {
      setLoading(true);

      // Fetch linguascripts (which are created from saved words)
      const { data: linguascripts, error } = await supabase
        .from("linguascripts")
        .select("id, target_word, sentence, translation, word_state, completed_at, scheduled_for")
        .eq("user_id", user.id)
        .eq("language", learningLanguage)
        .is("completed_at", null)
        .order("word_state", { ascending: false })
        .order("scheduled_for", { ascending: true });

      if (error) throw error;

      const now = new Date().toISOString();
      const due = (linguascripts || []).filter((e) => e.scheduled_for && e.scheduled_for <= now).length;

      setExercises(linguascripts || []);
      setDueCount(due);
    } catch (err) {
      console.error("Error loading exercises:", err);
      setExercises([]);
      setDueCount(0);
    } finally {
      setLoading(false);
    }
  }, [user, learningLanguage]);

  const handleStartSession = useCallback(() => {
    if (exercises.length === 0) return;

    const now = new Date().toISOString();
    const dueExercises = exercises.filter((e) => e.scheduled_for && e.scheduled_for <= now);
    const otherExercises = exercises.filter((e) => !dueExercises.find((d) => d.id === e.id));

    const sessionIds = [...dueExercises, ...otherExercises]
      .map((e) => e.id)
      .slice(0, 10);

    setSessionExerciseIds(sessionIds);
    setSessionActive(true);
  }, [exercises]);

  const handleSessionComplete = useCallback(
    async (data: { totalXp: number; exercises: string[] }) => {
      setSessionActive(false);
      setSessionExerciseIds([]);
      await loadExercises();
    },
    [loadExercises]
  );

  if (sessionActive) {
    return (
      <LinguaScriptSession
        exerciseIds={sessionExerciseIds}
        onSessionComplete={handleSessionComplete}
      />
    );
  }

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
          <p className="text-slate-400">Loading your LinguaScripts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900">
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

      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
            <div className="text-3xl font-bold text-amber-400">{dueCount}</div>
            <div className="text-sm text-slate-400 mt-1">Due today</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
            <div className="text-3xl font-bold text-emerald-400">{exercises.length}</div>
            <div className="text-sm text-slate-400 mt-1">Total exercises</div>
          </div>
          <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
            <div className="text-3xl font-bold text-blue-400">0</div>
            <div className="text-sm text-slate-400 mt-1">Completed today</div>
          </div>
        </div>

        {dueCount > 0 && (
          <button
            onClick={handleStartSession}
            className="w-full bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold py-4 rounded-lg mb-8 hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start Session ({dueCount} ready)
          </button>
        )}

        {exercises.length > 0 ? (
          ["red", "orange", "green"].map((state) => {
            const stateExercises = exercises.filter((e) => e.word_state === state);
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
                      className="bg-slate-800 hover:bg-slate-700 rounded-lg p-4 border border-slate-700 hover:border-slate-600 transition-all"
                    >
                      <p className="font-bold text-lg mb-2 text-slate-100">{exercise.target_word}</p>
                      <p className="text-sm text-slate-400 italic mb-3 line-clamp-2">"{exercise.sentence}"</p>
                      <p className="text-xs text-slate-500">{exercise.translation}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        ) : (
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
