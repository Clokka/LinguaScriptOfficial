import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDailyWordGoal } from "@/hooks/useDailyWordGoal";

interface LinguaScriptsPendingAlertProps {
  count: number;
  estimatedTime?: number; // in minutes
  /** Optional in-page session. Without it (or if it no-ops) we go to /linguascripts. */
  onStart?: () => void;
}

const GREEN = "#34C759";

export function LinguaScriptsPendingAlert({ count, onStart }: LinguaScriptsPendingAlertProps) {
  const navigate = useNavigate();
  const { learningLanguage } = useLanguage();
  const { goal } = useDailyWordGoal(learningLanguage || undefined);
  // Daily cap: never show more than the learner's word goal.
  const today = Math.min(count, goal || count);
  const start = () => {
    if (onStart) onStart();
    else navigate("/flashcards");
  };
  return (
    <div
      className="mb-8 rounded-2xl border p-6"
      style={{ borderColor: `${GREEN}55`, background: `${GREEN}14` }}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
        Flashcards
      </p>
      <h2 className="text-2xl font-extrabold leading-tight text-white">
        <span style={{ color: GREEN }}>{today}</span> word{today !== 1 ? "s" : ""} to review today
      </h2>
      <p className="mt-2 text-sm text-white/60">
        Review them before they fade from memory · +{today * 15} XP
      </p>
      <button
        onClick={start}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl py-3 font-bold text-black transition-opacity hover:opacity-90"
        style={{ background: GREEN }}
      >
        Start review <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
