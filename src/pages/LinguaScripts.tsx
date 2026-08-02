import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LanguageContext } from "@/contexts/LanguageContext";
import { LinguaScriptExercise } from "@/components/LinguaScriptExercise";
import { LineBlastEffect } from "@/components/LineBlastEffect";
import { ArrowLeft, Zap, BookOpen, Loader2 } from "lucide-react";
import { type LinguaScript } from "@/lib/linguascripts";
import {
  loadUserSavedWords,
  generateLinguaScriptFromWord,
  createLinguaScriptFromSavedWord,
  type SavedWord,
} from "@/lib/linguascripts";

type ViewMode = "mission" | "exercise";
type ExerciseMode = "gap-fill" | "guess-the-word" | "mcq" | "speaking";

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
  const [greenScripts, setGreenScripts] = useState<LinguaScript[]>([]);
  const [orangeScripts, setOrangeScripts] = useState<LinguaScript[]>([]);
  const [redScripts, setRedScripts] = useState<LinguaScript[]>([]);
  const [loadingScripts, setLoadingScripts] = useState(true);

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
  const nativeLanguage = user?.user_metadata?.native_language || "en";

  // Load user's saved words and generate LinguaScripts
  useEffect(() => {
    if (!user) return;

    const loadAndGenerateScripts = async () => {
      setLoadingScripts(true);
      try {
        const savedWords = await loadUserSavedWords(user.id, language);

        // Generate LinguaScripts for each word state group (GREEN → ORANGE → RED)
        const greenScriptsList: LinguaScript[] = [];
        const orangeScriptsList: LinguaScript[] = [];
        const redScriptsList: LinguaScript[] = [];

        // Process GREEN words (confidence building)
        for (const word of savedWords.green) {
          try {
            const generated = await generateLinguaScriptFromWord({
              word: word.word,
              interests,
              cefLevel,
              language,
              wordState: "green",
              nativeLanguage,
            });

            if (generated) {
              const script = await createLinguaScriptFromSavedWord(
                user.id,
                word.word,
                generated.sentence,
                generated.translation,
                "green",
                language,
                interests
              );

              if (script) {
                greenScriptsList.push(script);
              }
            }
          } catch (err) {
            console.error(`Failed to generate script for "${word.word}":`, err);
          }
        }

        // Process ORANGE words (reinforcement)
        for (const word of savedWords.orange) {
          try {
            const generated = await generateLinguaScriptFromWord({
              word: word.word,
              interests,
              cefLevel,
              language,
              wordState: "orange",
              nativeLanguage,
            });

            if (generated) {
              const script = await createLinguaScriptFromSavedWord(
                user.id,
                word.word,
                generated.sentence,
                generated.translation,
                "orange",
                language,
                interests
              );

              if (script) {
                orangeScriptsList.push(script);
              }
            }
          } catch (err) {
            console.error(`Failed to generate script for "${word.word}":`, err);
          }
        }

        // Process RED words (new acquisition)
        for (const word of savedWords.red) {
          try {
            const generated = await generateLinguaScriptFromWord({
              word: word.word,
              interests,
              cefLevel,
              language,
              wordState: "red",
              nativeLanguage,
            });

            if (generated) {
              const script = await createLinguaScriptFromSavedWord(
                user.id,
                word.word,
                generated.sentence,
                generated.translation,
                "red",
                language,
                interests
              );

              if (script) {
                redScriptsList.push(script);
              }
            }
          } catch (err) {
            console.error(`Failed to generate script for "${word.word}":`, err);
          }
        }

        setGreenScripts(greenScriptsList);
        setOrangeScripts(orangeScriptsList);
        setRedScripts(redScriptsList);
      } catch (err) {
        console.error("Failed to load and generate scripts:", err);
      } finally {
        setLoadingScripts(false);
      }
    };

    loadAndGenerateScripts();
  }, [user, language, interests, cefLevel, nativeLanguage]);

  function handleStartExercise(script: LinguaScript) {
    setSelectedScript(script);
    setViewMode("exercise");
  }

  async function handleExerciseComplete(completedScript: any) {
    if (completedScript.status === "completed" && completedScript.xp_earned) {
      setLastXP(completedScript.xp_earned);
      setLastCombo(completedScript.combo_multiplier || 1);
      setShowBlast(true);
      setTimeout(() => {
        setShowBlast(false);
        setSelectedScript(null);
        setViewMode("mission");
        // Reload scripts to reflect completion
        window.location.reload();
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
              <p className="text-xs text-slate-500 font-medium tracking-widest uppercase">AI-Personalized SRS Learning</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {viewMode === "mission" ? (
          <div className="space-y-8">
            {/* Loading State */}
            {loadingScripts && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-amber-400 animate-spin mb-4" />
                <p className="text-slate-400">Generating personalized exercises...</p>
              </div>
            )}

            {/* No Words Message */}
            {!loadingScripts && greenScripts.length === 0 && orangeScripts.length === 0 && redScripts.length === 0 && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 text-center">
                <p className="text-slate-400 mb-4">No saved words yet. Start watching videos and save words to create personalized exercises.</p>
                <button
                  onClick={() => navigate("/discover")}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg transition-all duration-300"
                >
                  Browse Videos
                </button>
              </div>
            )}

            {/* GREEN Words (Confidence Building) */}
            {!loadingScripts && greenScripts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
                  <h2 className="text-2xl font-black text-emerald-400">Boost Confidence (Known Words)</h2>
                </div>
                <p className="text-sm text-slate-400">Review words you already know to build confidence</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {greenScripts.map((script) => (
                    <div
                      key={script.id}
                      onClick={() => handleStartExercise(script)}
                      className="group relative cursor-pointer bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 border border-emerald-500/30 rounded-xl p-6 hover:border-emerald-400 hover:shadow-lg transition-all hover:scale-105"
                    >
                      <div className="mb-3">
                        <span className="inline-block px-2 py-1 bg-emerald-500/20 rounded text-xs font-bold text-emerald-400">
                          REVIEW
                        </span>
                      </div>
                      <p className="font-bold text-lg mb-2 text-emerald-300">{script.target_word}</p>
                      <p className="text-sm text-slate-400 mb-4 italic line-clamp-2">"{script.sentence}"</p>
                      <div className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">→ Start Practice</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ORANGE Words (Learning & Reinforcement) */}
            {!loadingScripts && orangeScripts.length > 0 && (
              <div className="space-y-4 mt-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <h2 className="text-2xl font-black text-amber-400">Reinforce Learning (Learning Words)</h2>
                </div>
                <p className="text-sm text-slate-400">Strengthen words you're currently learning</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orangeScripts.map((script) => (
                    <div
                      key={script.id}
                      onClick={() => handleStartExercise(script)}
                      className="group relative cursor-pointer bg-gradient-to-br from-amber-900/20 to-amber-900/5 border border-amber-500/30 rounded-xl p-6 hover:border-amber-400 hover:shadow-lg transition-all hover:scale-105"
                    >
                      <div className="mb-3">
                        <span className="inline-block px-2 py-1 bg-amber-500/20 rounded text-xs font-bold text-amber-400">
                          REINFORCE
                        </span>
                      </div>
                      <p className="font-bold text-lg mb-2 text-amber-300">{script.target_word}</p>
                      <p className="text-sm text-slate-400 mb-4 italic line-clamp-2">"{script.sentence}"</p>
                      <div className="text-xs text-amber-400 font-semibold uppercase tracking-wider">→ Start Practice</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* RED Words (New Acquisition) */}
            {!loadingScripts && redScripts.length > 0 && (
              <div className="space-y-4 mt-8">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-400"></div>
                  <h2 className="text-2xl font-black text-red-400">Learn New (New Words)</h2>
                </div>
                <p className="text-sm text-slate-400">Master new words in your target language</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {redScripts.map((script) => (
                    <div
                      key={script.id}
                      onClick={() => handleStartExercise(script)}
                      className="group relative cursor-pointer bg-gradient-to-br from-red-900/20 to-red-900/5 border border-red-500/30 rounded-xl p-6 hover:border-red-400 hover:shadow-lg transition-all hover:scale-105"
                    >
                      <div className="mb-3">
                        <span className="inline-block px-2 py-1 bg-red-500/20 rounded text-xs font-bold text-red-400">
                          NEW
                        </span>
                      </div>
                      <p className="font-bold text-lg mb-2 text-red-300">{script.target_word}</p>
                      <p className="text-sm text-slate-400 mb-4 italic line-clamp-2">"{script.sentence}"</p>
                      <div className="text-xs text-red-400 font-semibold uppercase tracking-wider">→ Start Practice</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {selectedScript && (
              <>
                <LinguaScriptExercise
                  key={selectedScript.id}
                  exerciseId={selectedScript.id}
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
                    ← Back to Exercises
                  </button>
                </div>
              </>
            )}
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
