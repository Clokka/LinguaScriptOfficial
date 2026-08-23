import { Zap, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface LinguaScriptsPendingAlertProps {
  count: number;
  estimatedTime?: number; // in minutes
  /** Optional in-page session. Without it (or if it no-ops) we go to /linguascripts. */
  onStart?: () => void;
}

export function LinguaScriptsPendingAlert({
  count,
  estimatedTime = 5,
  onStart,
}: LinguaScriptsPendingAlertProps) {
  const navigate = useNavigate();
  const start = () => {
    if (onStart) onStart();
    else navigate("/linguascripts");
  };
  return (
    <div className="mb-8 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-emerald-500/10 border border-amber-500/30 rounded-2xl p-8 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-500/30 rounded-lg animate-pulse">
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-amber-400 to-emerald-400 bg-clip-text text-transparent">
              🔥 {count} LinguaScripts Ready for Review
            </h2>
          </div>
          <p className="text-sm text-slate-400 mb-2">
            Review the words you learned before they fade from memory
          </p>
          <p className="text-xs text-slate-500">
            {estimatedTime} min • {count} word{count !== 1 ? "s" : ""} • +{Math.round(count * 15)} XP
          </p>
        </div>

        <Button
          onClick={start}
          className="whitespace-nowrap bg-gradient-to-r from-amber-400 to-emerald-400 text-slate-900 font-bold hover:shadow-lg hover:shadow-amber-500/50 transition-all"
        >
          Start <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
