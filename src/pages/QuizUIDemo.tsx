import { useState } from "react";
import { Sparkles, Check, X as XIcon, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function QuizUIDemo() {
  const [activeTab, setActiveTab] = useState<"a" | "b" | "hybrid">("hybrid");
  const [aAnswered, setAAnswered] = useState(false);
  const [aCorrect, setACorrect] = useState(false);
  const [aSelected, setASelected] = useState<string | null>(null);

  const [bAnswered, setBAnswered] = useState(false);
  const [bCorrect, setBCorrect] = useState(false);
  const [bSelected, setBSelected] = useState<string | null>(null);

  const [hybridAnswered, setHybridAnswered] = useState(false);
  const [hybridCorrect, setHybridCorrect] = useState(false);
  const [hybridSelected, setHybridSelected] = useState<string | null>(null);

  const options = ["want / would like", "see", "walk", "think"];
  const correctAnswer = options[0];

  const handleASelect = (opt: string) => {
    if (aAnswered) return;
    setASelected(opt);
    const correct = opt === correctAnswer;
    setACorrect(correct);
    setAAnswered(true);
  };

  const handleBSelect = (opt: string) => {
    if (bAnswered) return;
    setBSelected(opt);
    const correct = opt === correctAnswer;
    setBCorrect(correct);
    setBAnswered(true);
  };

  const handleHybridSelect = (opt: string) => {
    if (hybridAnswered) return;
    setHybridSelected(opt);
    const correct = opt === correctAnswer;
    setHybridCorrect(correct);
    setHybridAnswered(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            LinguaScript Quiz UI Variations
          </h1>
          <p className="text-slate-400 text-lg">
            Choose your vibe. Both versions reinforce the SRS with 1-3-5-7 scheduling.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-3 mb-8">
          <Button
            onClick={() => setActiveTab("a")}
            variant={activeTab === "a" ? "default" : "outline"}
            className={activeTab === "a" ? "bg-emerald-600" : ""}
          >
            Variation A: Flow State
          </Button>
          <Button
            onClick={() => setActiveTab("b")}
            variant={activeTab === "b" ? "default" : "outline"}
            className={activeTab === "b" ? "bg-cyan-600" : ""}
          >
            Variation B: Algorithm Visible
          </Button>
          <Button
            onClick={() => setActiveTab("hybrid")}
            variant={activeTab === "hybrid" ? "default" : "outline"}
            className={activeTab === "hybrid" ? "bg-amber-600" : ""}
          >
            Hybrid (Recommended)
          </Button>
        </div>

        {/* VARIATION A: FLOW STATE */}
        {activeTab === "a" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
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
                      onClick={() => handleASelect(option)}
                      disabled={aAnswered}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-all text-left font-medium",
                        !aAnswered && "border-slate-600 bg-slate-700/50 hover:border-emerald-400 hover:bg-slate-700 cursor-pointer",
                        aAnswered && aSelected === option && aCorrect && "border-emerald-400 bg-emerald-500/20 text-emerald-300",
                        aAnswered && aSelected === option && !aCorrect && "border-red-400 bg-red-500/20 text-red-300",
                        aAnswered && aSelected !== option && "border-slate-600 bg-slate-700/50 opacity-50"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {aAnswered && (
                  <div className={cn(
                    "p-4 rounded-lg border",
                    aCorrect
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-red-500/40 bg-red-500/10"
                  )}>
                    <p className={cn("font-bold", aCorrect ? "text-emerald-400" : "text-red-400")}>
                      {aCorrect ? "✓ Perfect!" : "✗ Try again"}
                    </p>
                    {aCorrect && <p className="text-sm text-emerald-300 mt-2">+15 XP • Streak: 3 days 🔥</p>}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4 text-emerald-400">Philosophy</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Zen & focused:</strong> Just answer the question. No noise.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Effortless learning:</strong> System invisible, just "doing the work"</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Quick feedback:</strong> Right/wrong + XP is all you need</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span><strong>Product speaks:</strong> Results over explanation</span>
                </li>
              </ul>
              <p className="text-slate-400 mt-6 text-sm">Best for casual learners who want to feel the progress, not analyze it.</p>
            </div>
          </div>
        )}

        {/* VARIATION B: ALGORITHM VISIBLE */}
        {activeTab === "b" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 rounded-2xl p-8 backdrop-blur-sm">
                <div className="mb-6 pb-6 border-b border-slate-700">
                  <div className="inline-block px-3 py-1 bg-cyan-500/20 rounded-lg mb-3">
                    <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest">Review Card • Day 2</p>
                  </div>
                  <p className="text-sm text-slate-400">SRS Level: <span className="text-cyan-400 font-bold">Orange (Learning)</span></p>
                </div>

                <h2 className="text-2xl font-black mb-6">
                  Which word means <span className="text-cyan-400">"want / would like"</span>?
                </h2>

                {/* Word state diagram */}
                <div className="mb-6 p-4 bg-slate-700/50 rounded-lg">
                  <p className="text-xs text-slate-400 uppercase mb-2">Word progression</p>
                  <div className="flex gap-2">
                    <div className="flex-1 text-center py-2 bg-red-500 rounded text-white text-xs font-bold">RED</div>
                    <div className="text-slate-500">→</div>
                    <div className="flex-1 text-center py-2 bg-amber-500 rounded text-white text-xs font-bold">ORANGE</div>
                    <div className="text-slate-500">→</div>
                    <div className="flex-1 text-center py-2 bg-emerald-500 rounded text-white text-xs font-bold">GREEN</div>
                  </div>
                </div>

                <div className="space-y-3 mb-8">
                  {options.map((option) => (
                    <button
                      key={option}
                      onClick={() => handleBSelect(option)}
                      disabled={bAnswered}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-all text-left font-medium",
                        !bAnswered && "border-slate-600 bg-slate-700/50 hover:border-cyan-400 hover:bg-slate-700 cursor-pointer",
                        bAnswered && bSelected === option && bCorrect && "border-emerald-400 bg-emerald-500/20 text-emerald-300",
                        bAnswered && bSelected === option && !bCorrect && "border-red-400 bg-red-500/20 text-red-300",
                        bAnswered && bSelected !== option && "border-slate-600 bg-slate-700/50 opacity-50"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {bAnswered && (
                  <div className={cn(
                    "p-4 rounded-lg border",
                    bCorrect
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-red-500/40 bg-red-500/10"
                  )}>
                    <div className="flex items-center justify-between">
                      <p className={cn("font-bold", bCorrect ? "text-emerald-400" : "text-red-400")}>
                        {bCorrect ? "✓ Correct!" : "✗ Not quite"}
                      </p>
                      {bCorrect && <p className="text-sm text-emerald-400">+15 XP → Next: GREEN (7 days)</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4 text-cyan-400">Philosophy</h3>
              <ul className="space-y-3 text-slate-300">
                <li className="flex gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span><strong>Transparent SRS:</strong> See RED → ORANGE → GREEN progression</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span><strong>Why this word?</strong> "Day 2" tells user the system is working</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span><strong>Gamified:</strong> State badges, next-stage hint, XP upfront</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-cyan-400">✓</span>
                  <span><strong>Ambitious learner:</strong> "I understand the system"</span>
                </li>
              </ul>
              <p className="text-slate-400 mt-6 text-sm">Best for users who want to see the algorithm work and understand why they're being tested.</p>
            </div>
          </div>
        )}

        {/* HYBRID: RECOMMENDED */}
        {activeTab === "hybrid" && (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
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
                      onClick={() => handleHybridSelect(option)}
                      disabled={hybridAnswered}
                      className={cn(
                        "w-full p-4 rounded-lg border-2 transition-all text-left font-medium",
                        !hybridAnswered && "border-slate-600 bg-slate-700/50 hover:border-amber-400 hover:bg-slate-700 cursor-pointer",
                        hybridAnswered && hybridSelected === option && hybridCorrect && "border-emerald-400 bg-emerald-500/20 text-emerald-300",
                        hybridAnswered && hybridSelected === option && !hybridCorrect && "border-red-400 bg-red-500/20 text-red-300",
                        hybridAnswered && hybridSelected !== option && "border-slate-600 bg-slate-700/50 opacity-50"
                      )}
                    >
                      {option}
                    </button>
                  ))}
                </div>

                {hybridAnswered && (
                  <div className={cn(
                    "p-4 rounded-lg border",
                    hybridCorrect
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-red-500/40 bg-red-500/10"
                  )}>
                    <p className={cn("font-bold text-lg", hybridCorrect ? "text-emerald-400" : "text-red-400")}>
                      {hybridCorrect ? "✓ Nailed it!" : "✗ Not quite"}
                    </p>
                    {hybridCorrect && (
                      <div className="mt-3 pt-3 border-t border-emerald-500/30">
                        <p className="text-sm text-emerald-300">
                          +15 XP • Orange → Green in 7 days
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8">
              <h3 className="text-xl font-bold mb-4 text-amber-400">The Best of Both</h3>
              <ul className="space-y-3 text-slate-300 mb-6">
                <li className="flex gap-2">
                  <span className="text-amber-400">✨</span>
                  <span><strong>Calm interface (A):</strong> No noise, clean layout, just answer</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-400">✨</span>
                  <span><strong>Subtle context (B):</strong> Word state hint ("Refresh") + stage preview</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-400">✨</span>
                  <span><strong>After answer:</strong> Show progress details (Orange → Green, next review)</span>
                </li>
              </ul>

              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                <p className="text-sm text-amber-200">
                  <strong>Why hybrid?</strong> Users who care about SRS see it. Users who don't? Just a zen quiz. Both paths work.
                </p>
              </div>

              <h4 className="text-sm font-bold text-amber-400 mt-6 mb-2">1-3-5-7 SRS Scheduling</h4>
              <p className="text-xs text-slate-400">
                Red (new) → Reviewed at 1 day → Orange → Reviewed at 3 days → Reviewed at 5 days → Green → Final check at 7 days
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-700">
          <h3 className="text-xl font-bold mb-4 text-slate-200">Implementation Path</h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <p className="font-bold text-emerald-400 mb-2">Phase 1: Hybrid Quiz</p>
              <p className="text-sm text-slate-400">Integrate into video player. Show word state subtly. Big immersion win.</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <p className="font-bold text-cyan-400 mb-2">Phase 2: Daily Goal Widget</p>
              <p className="text-sm text-slate-400">Home screen: "3/10 words saved today". Makes onboarding choice visible.</p>
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <p className="font-bold text-amber-400 mb-2">Phase 3: SRS Dashboard</p>
              <p className="text-sm text-slate-400">"My Words" page: RED/ORANGE/GREEN counts + next review dates.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
