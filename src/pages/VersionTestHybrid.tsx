import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function VersionTestHybrid() {
  const navigate = useNavigate();
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const options = ["want / would like", "see", "walk", "think"];
  const correctAnswer = options[0];

  const handleSelect = (opt: string) => {
    if (answered) return;
    setSelected(opt);
    setCorrect(opt === correctAnswer);
    setAnswered(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-2xl mx-auto">
        {/* Back button */}
        <Button
          onClick={() => navigate(-1)}
          variant="ghost"
          className="mb-8 text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to versions
        </Button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
            Version Test: Hybrid (Recommended)
          </h1>
          <p className="text-slate-400">Calm interface + subtle context hints. Best of both worlds.</p>
        </div>

        {/* Quiz Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
          <div className="mb-6">
            <div className="inline-block px-3 py-1 bg-amber-500/20 rounded-lg mb-3">
              <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                ✨ Learning Break
              </p>
            </div>
            <p className="text-xs text-slate-400 mb-2">Refresh: <span className="text-amber-400 font-semibold">voudrais</span></p>
          </div>

          <h2 className="text-3xl font-black mb-8">
            What does<br/>
            <span className="text-amber-400">"voudrais"</span><br/>
            mean?
          </h2>

          <div className="space-y-3 mb-8">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={answered}
                className={cn(
                  "w-full p-4 rounded-lg border-2 transition-all text-left font-medium text-base",
                  !answered && "border-slate-600 bg-slate-700/50 hover:border-amber-400 hover:bg-slate-700 cursor-pointer",
                  answered && selected === option && correct && "border-emerald-400 bg-emerald-500/20 text-emerald-300",
                  answered && selected === option && !correct && "border-red-400 bg-red-500/20 text-red-300",
                  answered && selected !== option && "border-slate-600 bg-slate-700/50 opacity-50"
                )}
              >
                {option}
              </button>
            ))}
          </div>

          {answered && (
            <div className={cn(
              "p-4 rounded-lg border",
              correct
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-red-500/40 bg-red-500/10"
            )}>
              <p className={cn("font-bold text-lg", correct ? "text-emerald-400" : "text-red-400")}>
                {correct ? "✓ Nailed it!" : "✗ Not quite"}
              </p>
              {correct && (
                <div className="mt-3 pt-3 border-t border-emerald-500/30">
                  <p className="text-sm text-emerald-300">
                    +15 XP • Orange → Green in 7 days
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Philosophy */}
        <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-4 text-amber-400">Why This Is Recommended</h3>
          <ul className="space-y-3 text-slate-300 mb-6">
            <li className="flex gap-3">
              <span className="text-amber-400 font-bold">✨</span>
              <span><strong>Calm interface (from A):</strong> No noise, clean layout. Just answer the question.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber-400 font-bold">✨</span>
              <span><strong>Subtle context (from B):</strong> Word hint ("Refresh") + state preview. Curiosity without cognitive load.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber-400 font-bold">✨</span>
              <span><strong>After answer:</strong> Show progress details (Orange → Green, next review). Reward curiosity.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-amber-400 font-bold">✨</span>
              <span><strong>Works for both types:</strong> Zen learners skip the context. System junkies explore it.</span>
            </li>
          </ul>

          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
            <p className="text-sm text-amber-200">
              <strong>The magic:</strong> Users who care about SRS see it. Users who don't? Just a zen quiz. Both paths work simultaneously.
            </p>
          </div>

          <h4 className="text-sm font-bold text-amber-400 mt-6 mb-2">1-3-5-7 SRS Scheduling</h4>
          <p className="text-xs text-slate-400">
            Red (new) → Reviewed at 1 day → Orange → Reviewed at 3 days → Reviewed at 5 days → Green → Final check at 7 days
          </p>
        </div>

        {/* Links */}
        <div className="mt-8 pt-8 border-t border-slate-700 flex gap-4 justify-center">
          <Button onClick={() => navigate("/versiontest1")} variant="outline">
            ← See Flow State
          </Button>
          <Button onClick={() => navigate("/versiontest2")} variant="outline">
            See Algorithm Visible →
          </Button>
        </div>
      </div>
    </div>
  );
}
