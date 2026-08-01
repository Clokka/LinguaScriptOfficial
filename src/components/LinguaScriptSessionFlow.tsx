import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LinguaScriptExercise } from "./LinguaScriptExercise";
import { Button } from "./ui/button";
import { ArrowLeft, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface SavedWord {
  id: string;
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context_phrase?: string;
  context_translation?: string;
  appearance_count?: number;
}

interface LinguaScriptSessionFlowProps {
  wordIds: string[];
  onSessionComplete?: (results: { totalXp: number; correctCount: number; totalCount: number }) => void;
  onClose?: () => void;
}

export function LinguaScriptSessionFlow({
  wordIds,
  onSessionComplete,
  onClose,
}: LinguaScriptSessionFlowProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { learningLanguage } = useLanguage();

  const [words, setWords] = useState<SavedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [totalXp, setTotalXp] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [sessionResults, setSessionResults] = useState<
    { word: string; correct: boolean; xp: number }[]
  >([]);

  useEffect(() => {
    loadWords();
  }, [wordIds]);

  async function loadWords() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("saved_words")
        .select("*")
        .eq("user_id", user?.id)
        .in("id", wordIds)
        .limit(wordIds.length);

      if (error) throw error;
      setWords((data as SavedWord[]) || []);
    } catch (err) {
      console.error("[LinguaScriptSessionFlow] Error loading words:", err);
      setWords([]);
    } finally {
      setLoading(false);
    }
  }

  function handleExerciseComplete(
    result: { xp_earned: number; correct: boolean },
    word: SavedWord
  ) {
    const newXp = totalXp + (result.xp_earned || 0);
    const newCorrect = correctCount + (result.correct ? 1 : 0);

    setTotalXp(newXp);
    setCorrectCount(newCorrect);
    setSessionResults((prev) => [
      ...prev,
      { word: word.word, correct: result.correct, xp: result.xp_earned || 0 },
    ]);

    // Confetti on last correct
    if (result.correct && currentIndex === words.length - 1) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#fbbf24", "#fcd34d", "#34d399", "#6ee7b7"],
      });
    }

    if (currentIndex < words.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Session complete
      setSessionComplete(true);
      onSessionComplete?.({
        totalXp: newXp,
        correctCount: newCorrect,
        totalCount: words.length,
      });
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your LinguaScripts...</p>
        </div>
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-slate-300 mb-2">No words to review</h2>
          <p className="text-slate-500 mb-6">Capture words from videos to create LinguaScripts</p>
          <Button onClick={onClose || (() => navigate("/discover"))}>
            Go back
          </Button>
        </div>
      </div>
    );
  }

  if (sessionComplete) {
    const accuracy =
      correctCount + sessionResults.filter((r) => !r.correct).length > 0
        ? Math.round((correctCount / words.length) * 100)
        : 0;

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-accent flex items-center justify-center mx-auto mb-6 shadow-glow-accent animate-bounce-in">
              <Trophy className="w-10 h-10 text-accent-foreground" />
            </div>

            <h2 className="text-3xl font-black text-slate-100 mb-2">
              Session Complete!
            </h2>
            <p className="text-slate-400 mb-8">Great job reviewing your LinguaScripts</p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-blue-400">{words.length}</p>
                <p className="text-xs text-slate-500">Words</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-emerald-400">{accuracy}%</p>
                <p className="text-xs text-slate-500">Accuracy</p>
              </div>
              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-2xl font-bold text-amber-400">+{totalXp}</p>
                <p className="text-xs text-slate-500">XP</p>
              </div>
            </div>

            <div className="bg-slate-700/30 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto">
              <p className="text-xs text-slate-500 uppercase tracking-wider mb-3">Results</p>
              <div className="space-y-2">
                {sessionResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm py-1 px-2 rounded"
                  >
                    <span className="text-slate-300">{result.word}</span>
                    <div className="flex items-center gap-2">
                      <span className={result.correct ? "text-emerald-400" : "text-red-400"}>
                        {result.correct ? "✓" : "✗"}
                      </span>
                      <span className="text-amber-400 text-xs">+{result.xp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Button
                onClick={onClose || (() => navigate("/discover"))}
                className="w-full bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold"
              >
                <Zap className="w-4 h-4 mr-2" />
                Now Go Watch More Content
              </Button>
              <Button
                onClick={() => navigate("/flashcards")}
                variant="outline"
                className="w-full"
              >
                View Reinforcement Reviews
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentWord = words[currentIndex];
  const progress = ((currentIndex + 1) / words.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Background gradients */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/80">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <Button
            onClick={onClose || (() => navigate("/discover"))}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <p className="text-sm text-slate-500">
              {currentIndex + 1} / {words.length}
            </p>
          </div>
          <div className="w-10" />
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Exercise */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {currentWord && (
          <LinguaScriptExercise
            key={`${currentWord.id}-${currentIndex}`}
            targetWord={currentWord.word}
            language={learningLanguage}
            mode="gap-fill"
            contextPhrase={currentWord.context_phrase}
            contextTranslation={currentWord.context_translation}
            onComplete={(result) => handleExerciseComplete(result, currentWord)}
          />
        )}
      </div>
    </div>
  );
}
