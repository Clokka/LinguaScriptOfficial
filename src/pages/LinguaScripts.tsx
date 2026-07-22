import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LanguageContext } from "@/contexts/LanguageContext";
import { useXp } from "@/hooks/useXp";
import { TodaysMission } from "@/components/TodaysMission";
import { LinguaScriptExercise } from "@/components/LinguaScriptExercise";
import { LineBlastEffect } from "@/components/LineBlastEffect";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Zap, BookOpen, Mic } from "lucide-react";
import { type LinguaScript } from "@/lib/linguascripts";

type ViewMode = "mission" | "exercise" | "stats";
type ExerciseMode = "gap-fill" | "mcq" | "speaking";

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

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (!user) {
        navigate("/auth");
      }
    };

    getUser();
  }, [navigate]);

  const language = langCtx?.language || "fr";
  const interests = user?.user_metadata?.interests || [];

  function handleStartExercise(script: LinguaScript) {
    setSelectedScript(script);
    setViewMode("exercise");
  }

  function handleExerciseComplete(script: LinguaScript) {
    if (script.xp_earned) {
      setLastXP(script.xp_earned);
      setLastCombo(script.combo_multiplier);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/discover")}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="w-6 h-6 text-emerald-500" />
                LinguaScripts
              </h1>
              <p className="text-xs text-slate-400">AI-powered sentence learning</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {viewMode === "mission" ? (
          <div className="space-y-8">
            {/* Today's Mission */}
            <TodaysMission
              language={language}
              onStartExercise={handleStartExercise}
            />

            {/* Features Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-blue-400" />
                    Gap-Fill
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400">
                    Fill in the missing word to complete the sentence
                  </p>
                  <Button
                    onClick={() => {
                      setExerciseMode("gap-fill");
                      setViewMode("exercise");
                    }}
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                  >
                    Try Gap-Fill
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    Multiple Choice
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400">
                    Select the correct translation from four options
                  </p>
                  <Button
                    onClick={() => {
                      setExerciseMode("mcq");
                      setViewMode("exercise");
                    }}
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                  >
                    Try MCQ
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Mic className="w-5 h-5 text-red-400" />
                    Speaking
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-400">
                    Speak the word and get real-time feedback (coming soon)
                  </p>
                  <Button
                    disabled
                    variant="outline"
                    size="sm"
                    className="mt-4 w-full"
                  >
                    Coming Soon
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* How It Works */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle>How LinguaScripts Work</CardTitle>
                <CardDescription>
                  Your personal AI vocabulary trainer
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                        1
                      </span>
                      AI Generation
                    </h3>
                    <p className="text-sm text-slate-400">
                      Our AI creates contextual sentences based on your interests
                      and learning level
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                        2
                      </span>
                      Multiple Modes
                    </h3>
                    <p className="text-sm text-slate-400">
                      Practice with gap-fill, multiple choice, and speaking
                      exercises
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                        3
                      </span>
                      Instant Feedback
                    </h3>
                    <p className="text-sm text-slate-400">
                      Get immediate corrections and celebrate your wins with
                      combos
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <span className="bg-emerald-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                        4
                      </span>
                      SRS Integration
                    </h3>
                    <p className="text-sm text-slate-400">
                      Completed words automatically schedule into your spaced
                      repetition system
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            {selectedScript ? (
              <LinguaScriptExercise
                key={selectedScript.id}
                targetWord={selectedScript.target_word}
                language={language}
                interests={interests}
                mode={exerciseMode}
                onComplete={handleExerciseComplete}
              />
            ) : (
              <div className="text-center py-12">
                <p className="text-slate-400 mb-4">No exercise selected</p>
                <Button onClick={() => setViewMode("mission")}>
                  Back to Mission
                </Button>
              </div>
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
