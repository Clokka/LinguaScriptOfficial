import { Bell, CreditCard, Sparkles } from "lucide-react";

/**
 * The honest trial promise, shown before checkout: what happens today, when
 * we remind you, and when the plan starts. Mirrors create-checkout (14 days)
 * and payments-webhook (reminder on Stripe's trial_will_end, 3 days before).
 */
const STEPS = [
  { icon: Sparkles, day: "Today", label: "Everything unlocked", color: "#34C759" },
  { icon: Bell, day: "Day 11", label: "We remind you", color: "#FF8A00" },
  { icon: CreditCard, day: "Day 14", label: "Plan starts", color: "#ffffff" },
];

export function TrialTimeline({ className = "" }: { className?: string }) {
  return (
    <ol className={`flex items-start justify-between gap-2 ${className}`}>
      {STEPS.map(({ icon: Icon, day, label, color }, i) => (
        <li key={day} className="relative flex flex-1 flex-col items-center text-center">
          {i < STEPS.length - 1 && (
            <span aria-hidden className="absolute left-1/2 top-5 h-px w-full bg-white/15" />
          )}
          <span
            className="relative flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-[#0a0f0d]"
            style={{ color }}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span className="mt-2 text-xs font-bold text-white">{day}</span>
          <span className="text-[11px] text-white/50">{label}</span>
        </li>
      ))}
    </ol>
  );
}
