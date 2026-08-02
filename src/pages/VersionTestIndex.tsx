import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

export function VersionTestIndex() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-emerald-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
            LinguaScript Quiz UI Versions
          </h1>
          <p className="text-slate-400 text-lg">
            Three approaches to making the SRS system feel effortless, transparent, or somewhere in between.
          </p>
        </div>

        {/* Version Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {/* Version 1: Flow State */}
          <div
            onClick={() => navigate("/versiontest1")}
            className="bg-gradient-to-br from-emerald-900/20 to-emerald-900/5 border border-emerald-500/30 rounded-2xl p-8 cursor-pointer hover:border-emerald-400/60 hover:from-emerald-900/30 transition-all group"
          >
            <div className="text-4xl mb-4">🌊</div>
            <h2 className="text-2xl font-black text-emerald-400 mb-3">Flow State</h2>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Zen, focused, minimal. Just the question. System invisible. Perfect for users who want effortless learning.
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/versiontest1");
              }}
            >
              Try Flow State
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Version 2: Algorithm Visible */}
          <div
            onClick={() => navigate("/versiontest2")}
            className="bg-gradient-to-br from-cyan-900/20 to-cyan-900/5 border border-cyan-500/30 rounded-2xl p-8 cursor-pointer hover:border-cyan-400/60 hover:from-cyan-900/30 transition-all group"
          >
            <div className="text-4xl mb-4">🧠</div>
            <h2 className="text-2xl font-black text-cyan-400 mb-3">Algorithm Visible</h2>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Transparent SRS. See RED → ORANGE → GREEN. Perfect for users who want to understand the system.
            </p>
            <Button
              className="w-full bg-cyan-600 hover:bg-cyan-500"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/versiontest2");
              }}
            >
              Try Algorithm Visible
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Version 3: Hybrid */}
          <div
            onClick={() => navigate("/versiontest3")}
            className="bg-gradient-to-br from-amber-900/20 to-amber-900/5 border border-amber-500/30 rounded-2xl p-8 cursor-pointer hover:border-amber-400/60 hover:from-amber-900/30 transition-all group"
          >
            <div className="text-4xl mb-4">✨</div>
            <h2 className="text-2xl font-black text-amber-400 mb-3">Hybrid (Recommended)</h2>
            <p className="text-slate-400 mb-6 text-sm leading-relaxed">
              Best of both. Calm interface + subtle context. Works for both zen learners and system nerds.
            </p>
            <Button
              className="w-full bg-amber-600 hover:bg-amber-500"
              onClick={(e) => {
                e.stopPropagation();
                navigate("/versiontest3");
              }}
            >
              Try Hybrid
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Info Section */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
          <h3 className="text-xl font-bold mb-4 text-slate-200">How to Use</h3>
          <p className="text-slate-400 mb-4">
            Click any version above to see an interactive demo. After choosing a vibe, we'll implement it with:
          </p>
          <ul className="space-y-2 text-slate-400">
            <li className="flex gap-3">
              <span className="text-emerald-400">✓</span>
              <span><strong>Daily goal widget:</strong> Home screen shows "3/10 words saved today"</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400">✓</span>
              <span><strong>Quiz during video:</strong> Integrated into player (not modal popup)</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400">✓</span>
              <span><strong>SRS visibility:</strong> Users see RED/ORANGE/GREEN word states</span>
            </li>
            <li className="flex gap-3">
              <span className="text-emerald-400">✓</span>
              <span><strong>1-3-5-7 scheduling:</strong> Words auto-review at those intervals</span>
            </li>
          </ul>

          <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-sm font-bold text-slate-300 mb-2">URLs for Testing</h4>
            <div className="bg-slate-900 rounded-lg p-3 font-mono text-xs text-slate-400 space-y-1">
              <div>/versiontest1 — Flow State</div>
              <div>/versiontest2 — Algorithm Visible</div>
              <div>/versiontest3 — Hybrid (Recommended)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
