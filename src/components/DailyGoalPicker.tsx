import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { WORD_GOAL_PRESETS } from "@/lib/progressStats";

/**
 * The daily goal picker, in words per day.
 *
 * It used to ask for videos per day and derive the word target behind the
 * learner's back — picking "3 videos" quietly signed them up for forty words.
 * The number they commit to should be the number they are held to.
 */
interface DailyGoalPickerProps {
  /** Words per day. */
  value: number;
  onChange: (words: number) => void;
  compact?: boolean;
}

export const DailyGoalPicker = ({ value, onChange, compact }: DailyGoalPickerProps) => {
  return (
    <div className="space-y-4">
      <div className={cn("grid gap-3", compact ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-3")}>
        {WORD_GOAL_PRESETS.map((preset) => {
          const selected = value === preset.words;
          return (
            <motion.button
              key={preset.words}
              type="button"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(preset.words)}
              aria-pressed={selected}
              className={cn(
                "relative text-left rounded-2xl p-5 border transition-all overflow-hidden",
                selected
                  ? "border-orange-400 bg-gradient-to-br from-orange-50 to-white shadow-[0_12px_32px_-12px_rgba(249,115,22,0.45)]"
                  : "border-orange-100 bg-white hover:border-orange-300",
              )}
            >
              {selected && (
                <span className="absolute top-3 right-3 inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500 text-white">
                  <Check className="w-3.5 h-3.5" strokeWidth={3} />
                </span>
              )}
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-neutral-900">
                  {preset.words}
                </span>
                <span className="text-sm text-neutral-500">
                  word{preset.words > 1 ? "s" : ""}/day
                </span>
              </div>
              <div className="mt-3 space-y-1.5 text-[13px] text-neutral-600">
                <p>
                  <span className="font-medium text-neutral-900">{preset.perYear}</span>{" "}
                  words a year
                </p>
                <p className="text-neutral-500">{preset.label}</p>
              </div>
              <p className="mt-3 text-xs italic text-orange-600 leading-snug">
                {preset.milestone}
              </p>
            </motion.button>
          );
        })}
      </div>
      <div className="flex items-start gap-2 text-xs text-neutral-500 leading-relaxed">
        <Sparkles className="w-3.5 h-3.5 mt-0.5 text-orange-500 shrink-0" />
        <p>Small and daily beats big and occasional. You can always do more.</p>
      </div>
    </div>
  );
};
