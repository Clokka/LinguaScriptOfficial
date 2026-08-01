import { Clock, BookOpen } from "lucide-react";

interface FlashcardsDueAlertProps {
  count: number;
  nextReviewTime?: string;
}

export function FlashcardsDueAlert({ count, nextReviewTime }: FlashcardsDueAlertProps) {
  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "Tomorrow";
    const date = new Date(timestamp);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === tomorrow.toDateString()) {
      return "Tomorrow at 9:00 AM";
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="mb-8 bg-gradient-to-r from-indigo-500/20 to-purple-500/10 border border-indigo-500/30 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-indigo-500/30 rounded-lg">
          <Clock className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-indigo-300 mb-1">
            ⏰ {count} Reinforcement Review{count !== 1 ? "s" : ""} Ready Tomorrow
          </h3>
          <p className="text-sm text-slate-400">
            {count} word{count !== 1 ? "s" : ""} you captured are ready to reinforce tomorrow
          </p>
          <p className="text-xs text-indigo-300/70 mt-2">
            Next review: {formatTime(nextReviewTime)}
          </p>
          <p className="text-xs text-slate-500 mt-3">
            💡 Browse and capture more content in the meantime!
          </p>
        </div>
      </div>
    </div>
  );
}
