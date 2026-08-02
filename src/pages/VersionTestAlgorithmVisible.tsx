import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function VersionTestAlgorithmVisible() {
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
          <h1 className="text-3xl font-black mb-2 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            Version Test: Algorithm Visible
          </h1>
          <p className="text-slate-400">Transparent SRS—show users why they're being tested</p>
        </div>

        {/* Quiz Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
          <div className="mb-6 pb-6 border-b border-slate-700">
            <div className="inline-block px-3 py-1 bg-cyan-500/20 rounded-lg mb-3">
              <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Review Card • Day 2</p>
            </div>
            <p className="text-sm text-slate-400">Word state: <span className="text-cyan-400 font-bold">Orange (Learning)</span></p>
          </div>

          <h2 className="text-2xl font-black mb-6">
            Which word means <span className="text-cyan-400">"want / would like"</span>?
          </h2>

          {/* Word state diagram */}
          <div className="mb-6 p-4 bg-slate-700/50 rounded-lg border border-slate-600">
            <p className="text-xs text-slate-400 uppercase mb-2 font-bold">Word progression</p>
            <div className="flex gap-2">
              <div className="flex-1 text-center py-2 bg-red-500 rounded text-white text-xs font-bold">RED</div>
              <div className="text-slate-500 flex items-center">→</div>
              <div className="flex-1 text-center py-2 bg-amber-500 rounded text-white text-xs font-bold">ORANGE</div>
              <div className="text-slate-500 flex items-center">→</div>
              <div className="flex-1 text-center py-2 bg-emerald-500 rounded text-white text-xs font-bold">GREEN</div>
            </div>
          </div>

          <div className="space-y-3 mb-8">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleSelect(option)}
                disabled={answered}
                className={cn(
                  "w-full p-4 rounded-lg border-2 transition-all text-left font-medium text-base",
                  !answered && "border-slate-600 bg-slate-700/50 hover:border-cyan-400 hover:bg-slate-700 cursor-pointer",
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
              <div className="flex items-center justify-between">
                <p className={cn("font-bold", correct ? "text-emerald-400" : "text-red-400")}>
                  {correct ? "✓ Correct!" : "✗ Not quite"}
                </p>
                {correct && <p className="text-sm text-emerald-400 font-bold">+15 XP → Next: GREEN (7 days)</p>}
              </div>
            </div>
          )}
        </div>

        {/* Philosophy */}
        <div className="mt-8 bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-4 text-cyan-400">Why This Works</h3>
          <ul className="space-y-3 text-slate-300">
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">✓</span>
              <span><strong>Transparent SRS:</strong> Users see RED → ORANGE → GREEN progression. They understand the system.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">✓</span>
              <span><strong>Why this word?</strong> "Day 2" + "Orange" tells users: "The algorithm knows you need this."</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">✓</span>
              <span><strong>Gamified:</strong> State badges, next-stage hints, XP upfront. Ambitious learners love this.</span>
            </li>
            <li className="flex gap-3">
              <span className="text-cyan-400 font-bold">✓</span>
              <span><strong>Builds trust:</strong> Users see the algorithm working intelligently for them.</span>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div className="mt-8 pt-8 border-t border-slate-700 flex gap-4 justify-center">
          <Button onClick={() => navigate("/versiontest1")} variant="outline">
            ← See Flow State
          </Button>
          <Button onClick={() => navigate("/versiontest3")} variant="outline">
            See Hybrid →
          </Button>
        </div>
      </div>
    </div>
  );
}
