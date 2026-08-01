import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LanguageContext } from "@/contexts/LanguageContext";
import { TodaysMission } from "@/components/TodaysMission";
import { LinguaScriptExercise } from "@/components/LinguaScriptExercise";
import { LineBlastEffect } from "@/components/LineBlastEffect";
import { ArrowLeft, Zap, BookOpen, Mic, Award, Loader2 } from "lucide-react";
import { type LinguaScript } from "@/lib/linguascripts";
import {
  loadUserSavedWords,
  generatePersonalizedLinguaScript,
  createLinguaScriptSessionFromWord,
  type SavedWord,
} from "@/lib/linguascripts";

type ViewMode = "mission" | "exercise" | "loading";
type ExerciseMode = "gap-fill" | "mcq" | "speaking";

interface WordWithScript extends SavedWord {
  linguaScript?: LinguaScript;
  loading?: boolean;
}

export default function LinguaScriptsPage() {
  const navigate = useNavigate();
  const langCtx = useContext(LanguageContext);
  const [viewMode, setViewMode] = useState<ViewMode>("mission");
  const [selectedScript, setSelectedScript] = useState<LinguaScript | null>(null);
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode>("gap-fill");
  const [user, setUser] = useState<any>(null);
  const [showBlast, setShowBlast] = useState(false);
  const [lastXP, setLastXP] = useState(0);
  const [lastCombo, setLastCombo] = useState(1);
  const [greenWords, setGreenWords] = useState<WordWithScript[]>([]);
  const [orangeWords, setOrangeWords] = useState<WordWithScript[]>([]);
  const [redWords, setRedWords] = useState<WordWithScript[]>([]);
  const [generatedScripts, setGeneratedScripts] = useState<Map<string, LinguaScript>>(
    new Map()
  );

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (!user) navigate("/auth");
    };
    getUser();
  }, [navigate]);

  const language = langCtx?.languageContext || "fr";
  const interests = user?.user_metadata?.interests || [];
  const cefLevel = user?.user_metadata?.cef_level || "B1";

  // Load user's saved words and generate LinguaScripts
  useEffect(() => {
    if (!user) return;

    const loadAndGenerateScripts = async () => {
      const words = await loadUserSavedWords(user.id, language);

      // Process GREEN words first (confidence building)
      setGreenWords(words.green.map((w) => ({ ...w, state: "green" as const })));
      setOrangeWords(
        words.orange.map((w) => ({ ...w, state: "orange" as const }))
      );
      setRedWords(words.red.map((w) => ({ ...w, state: "red" as const })));

      // Generate LinguaScripts for each word group
      generateScriptsForWords(
        words.green.map((w) => ({ ...w, state: "green" as const })),
        "green"
      );
    };

    loadAndGenerateScripts();
  }, [user, language]);

  const generateScriptsForWords = async (
    words: WordWithScript[],
    state: "green" | "orange" | "red"
  ) => {
    for (const word of words) {
      try {
        const result = await generatePersonalizedLinguaScript({
          word: word.word,
          translation: word.translation,
          interests,
          cefLevel,
          language,
          wordState: state,
          nativeLanguage: user?.user_metadata?.native_language || "en",
        });

        if (result) {
          const script = await createLinguaScriptSessionFromWord(
            user.id,
            word.word,
            word.translation,
            result.sentence,
            result.englishTranslation,
            state,
            interests,
            language
          );

          if (script) {
            setGeneratedScripts((prev) =>
              new Map(prev).set(`${word.word}-${state}`, script)
            );
          }
        }
      } catch (err) {
        console.error(`Failed to generate script for ${word.word}:`, err);
      }
    }
  };

  function handleStartExercise(script: LinguaScript) {
    setSelectedScript(script);
    setViewMode("exercise");
  }

  function handleExerciseComplete(script: LinguaScript) {
    if (script.xp_earned) {
      setLastXP(script.xp_earned);
      setLastCombo(script.combo_multiplier || 1);
      setShowBlast(true);
      setTimeout(() => {
        setShowBlast(false);
        setSelectedScript(null);
        setViewMode("mission");
      }, 2000);
    } else {
      setSelectedScript(null);
      setViewMode("mission");
    }
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
      {/* Animated background gradient */}
      <div className="fixed inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-emerald-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }}></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 border-b border-slate-800/50 backdrop-blur-xl bg-slate-950/80">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/discover")}
              className="p-2.5 hover:bg-slate-800 rounded-lg transition-all duration-300 hover:scale-110"
            >
              <ArrowLeft className="w-5 h-5 text-slate-400" />
            </button>
            <div>
              <h1 className="text-3xl font-black bg-gradient-to-r from-amber-400 via-amber-300 to-emerald-400 bg-clip-text text-transparent flex items-center gap-3">
                <Zap className="w-8 h-8 text-amber-400 drop-shadow-lg" style={{ filter: "drop-shadow(0 0 8px rgba(251, 191, 36, 0.6))" }} />
                LinguaScripts
              </h1>
              <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">Daily Vocabulary Challenge</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {viewMode === "mission" ? (
          <div className="space-y-8">
            {/* Today's Mission - Enhanced */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <TodaysMission
                  language={language}
                  onStartExercise={handleStartExercise}
                />
              </div>
            </div>

            {/* Personalized LinguaScripts from Saved Words */}
            {(generatedScripts.size > 0 || greenWords.length > 0) && (
              <div className="space-y-6">
                {/* GREEN Words (Confidence Building) */}
                {generatedScripts.size > 0 && (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-black text-emerald-400">
                        🟢 Boost Confidence (Green Words)
                      </h2>
                      <p className="text-sm text-slate-400">Master these words you already know</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Array.from(generatedScripts.values())
                        .filter((s) => greenWords.some((w) => w.word === s.target_word))
                        .slice(0, 4)
                        .map((script) => (
                          <div
                            key={script.id}
                            onClick={() => handleStartExercise(script)}
                            className="group relative cursor-pointer bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 border border-emerald-500/30 rounded-xl p-6 hover:border-emerald-400 transition-all hover:scale-105"
                          >
                            <div className="mb-3">
                              <span className="inline-block px-2 py-1 bg-emerald-500/20 rounded text-xs font-bold text-emerald-400">
                                REVIEW
                              </span>
                            </div>
                            <p className="font-bold text-lg mb-2">{script.target_word}</p>
                            <p className="text-sm text-slate-400 mb-4 italic">
                              "{script.sentence}"
                            </p>
                            <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">
                              → Start Practice
                            </div>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Gap-Fill Card */}
              <div
                onClick={() => {
                  setSelectedScript(null);
                  setExerciseMode("gap-fill");
                  setViewMode("exercise");
                }}
                className="group relative cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-blue-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 hover:border-blue-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-blue-500/20 rounded-lg">
                      <BookOpen className="w-6 h-6 text-blue-400" />
                    </div>
                    <h3 className="font-bold text-lg">Gap-Fill</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">Complete the sentence by filling in the missing word</p>
                  <div className="text-xs text-blue-400 font-semibold uppercase tracking-wider">→ Try Now</div>
                </div>
              </div>

              {/* Multiple Choice Card */}
              <div
                onClick={() => {
                  setSelectedScript(null);
                  setExerciseMode("mcq");
                  setViewMode("exercise");
                }}
                className="group relative cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-amber-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 hover:border-amber-500/50 transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-amber-500/20 rounded-lg">
                      <Zap className="w-6 h-6 text-amber-400" />
                    </div>
                    <h3 className="font-bold text-lg">Multiple Choice</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">Select the correct translation from four options</p>
                  <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">→ Try Now</div>
                </div>
              </div>

              {/* Speaking Card */}
              <div className="group relative opacity-50 cursor-not-allowed">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-xl p-6 hover:border-red-500/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2.5 bg-red-500/20 rounded-lg">
                      <Mic className="w-6 h-6 text-red-400" />
                    </div>
                    <h3 className="font-bold text-lg">Speaking</h3>
                  </div>
                  <p className="text-sm text-slate-400 mb-4">Speak the word and get real-time feedback</p>
                  <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">🔒 Coming Soon</div>
                </div>
              </div>
            </div>

            {/* How It Works Section */}
            <div className="group relative mt-12">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-8">
                  <Award className="w-6 h-6 text-emerald-400" style={{ filter: "drop-shadow(0 0 8px rgba(52, 211, 153, 0.6))" }} />
                  <h2 className="text-2xl font-black">How LinguaScripts Work</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {[
                    { num: 1, title: "AI Generation", desc: "Our AI creates contextual sentences tailored to your interests and learning level" },
                    { num: 2, title: "Multiple Modes", desc: "Practice with gap-fill, multiple choice, and speaking exercises" },
                    { num: 3, title: "Instant Feedback", desc: "Get immediate corrections and celebrate your wins with combo multipliers" },
                    { num: 4, title: "SRS Integration", desc: "Master words through spaced repetition scheduling" },
                  ].map((item) => (
                    <div key={item.num} className="flex gap-4">
                      <div className="flex-shrink-0">
                        <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gradient-to-br from-amber-400 to-emerald-400 text-slate-900 font-bold">
                          {item.num}
                        </div>
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{item.title}</h3>
                        <p className="text-sm text-slate-400">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <LinguaScriptExercise
              key={selectedScript?.id || `free-${exerciseMode}`}
              targetWord={selectedScript?.target_word || "bonjour"}
              language={language}
              interests={interests}
              mode={exerciseMode}
              onComplete={handleExerciseComplete}
            />
            <div className="mt-6 text-center">
              <button
                onClick={() => setViewMode("mission")}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition-all duration-300"
              >
                ← Back to Mission
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Line Blast Effect */}
      <LineBlastEffect
        show={showBlast}
        xpGained={lastXP}
        combo={lastCombo}
        onComplete={() => setShowBlast(false)}
      />
    </div>
  );
}
