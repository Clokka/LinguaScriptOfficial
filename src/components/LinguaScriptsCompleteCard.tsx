import { CheckCircle2, Play, Compass, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LinguaScriptsCompleteCardProps {
  wordsReviewedToday?: number;
  newWordsCaptured?: number;
  onContinueWatching?: () => void;
  onDiscover?: () => void;
}

export function LinguaScriptsCompleteCard({
  wordsReviewedToday = 0,
  newWordsCaptured = 0,
  onContinueWatching,
  onDiscover,
}: LinguaScriptsCompleteCardProps) {
  return (
    <div className="mb-8 bg-gradient-to-br from-emerald-500/20 via-slate-800/50 to-slate-900/50 border border-emerald-500/30 rounded-2xl p-8 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/30 rounded-lg">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">
              All LinguaScripts Complete!
            </h2>
            <p className="text-sm text-slate-300">
              You've reviewed {wordsReviewedToday} word{wordsReviewedToday !== 1 ? "s" : ""} today
            </p>
            {newWordsCaptured > 0 && (
              <p className="text-xs text-emerald-300 mt-2">
                ✨ {newWordsCaptured} new word{newWordsCaptured !== 1 ? "s" : ""} captured and will appear in LinguaScripts starting tomorrow
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-slate-400 font-semibold uppercase tracking-wider mb-4">
          Now go learn more...
        </p>

        {onContinueWatching && (
          <Button
            onClick={onContinueWatching}
            className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold"
          >
            <Play className="w-4 h-4 mr-2" />
            Continue Watching
          </Button>
        )}

        {onDiscover && (
          <Button
            onClick={onDiscover}
            variant="outline"
            className="w-full border-slate-600 text-slate-300 hover:bg-slate-800"
          >
            <Compass className="w-4 h-4 mr-2" />
            Discover New Content
          </Button>
        )}
      </div>

      <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-400">
            <span className="text-amber-300 font-semibold">Pro tip:</span> Click any word in the subtitles to add it to your LinguaScripts. The more you capture, the more you learn!
          </p>
        </div>
      </div>
    </div>
  );
}
