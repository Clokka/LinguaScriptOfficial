import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function VersionTestFlowState() {
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
          <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Version Test: Flow State
          </h1>
          <p className="text-slate-400">Zen, focused, effortless learning experience</p>
        </div>

        {/* Quiz Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
          <div className="mb-8">
            <div className="inline-block px-3 py-1 bg-emerald-500/20 rounded-lg mb-4">
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                Learning Break
              </p>
            </div>
            <h2 className="text-2xl font-black">
              What does <span className="text-emerald-400">"voudrais"</span> mean?
            </h2>
            <p className="text-sm text-slate-400 mt-2">Tap an answer to continue</p>
          </div>

          <div className="space-y-3 mb-8">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={answered}
                className={cn(
                  "w-full p-4 rounded-lg border-2 transition-all text-left font-medium text-base",
                  !answered && "border-slate-600 bg-slate-700/50 hover:border-emerald-400 hover:bg-slate-700 cursor-pointer",
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
              <p className={cn("font-bold", correct ? "text-emerald-400" : "text-red-400")}>
                {correct ? "✓ Perfect!" : "✗ Try again"}
              </p>
              {correct && <p className="text-sm text-emerald-300 mt-2">+15 XP • Streak: 3 days 🔥</p>}
            </div>
          )}
        </div>

        {/* Philosophy */}
        <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-4 text-emerald-400">Why This Works</h3>
          <ul className="space-y-3 text-slate-300">
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>No distractions:</strong> Just the question and answers. System invisible.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Flow state:</strong> Users feel like they're just learning, not being tested by an algorithm.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Effortless:</strong> Quick feedback (right/wrong + XP). Minimal cognitive load.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400 font-bold">✓</span>
              <span><strong>Product speaks:</strong> Results over explanation. Users see they're learning.</span>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div className="mt-8 pt-8 border-t border-slate-700 flex gap-4 justify-center">
          <Button onClick={() => navigate("/versiontest2")} variant="outline">
            See Algorithm Visible →
          </Button>
          <Button onClick={() => navigate("/versiontest3")} variant="outline">
            See Hybrid →
          </Button>
        </div>
      </div>
    </div>
  );
}
