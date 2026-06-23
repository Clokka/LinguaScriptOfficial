import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { MemoryStage } from "@/lib/progressStats";

const STAGE_META: Record<MemoryStage, {
  label: string;
  sub: string;
  description: string;
  dot: string;
  bar: string;
  ring: string;
}> = {
  short: {
    label: "Must Review",
    sub: "Short-term memory",
    description: "Words reviewed only once. Learned recently but unstable.",
    dot: "bg-red-500",
    bar: "bg-gradient-to-r from-red-500 to-rose-500",
    ring: "border-red-200/70 bg-red-50/40",
  },
  medium: {
    label: "Reinforcing",
    sub: "Medium-term memory",
    description: "Reviewed 2–3 times. Partially reinforced.",
    dot: "bg-amber-500",
    bar: "bg-gradient-to-r from-amber-500 to-orange-500",
    ring: "border-amber-200/70 bg-amber-50/40",
  },
  long: {
    label: "Acquired",
    sub: "Long-term memory",
    description: "Reviewed 4+ times. Strong retention.",
    dot: "bg-emerald-500",
    bar: "bg-gradient-to-r from-emerald-500 to-green-500",
    ring: "border-emerald-200/70 bg-emerald-50/40",
  },
};

interface MemoryStageCardProps {
  stage: MemoryStage;
  count: number;
  total: number;
  delay?: number;
}

export const MemoryStageCard = ({ stage, count, total, delay = 0 }: MemoryStageCardProps) => {
  const meta = STAGE_META[stage];
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn("rounded-2xl border p-5 backdrop-blur-xl", meta.ring)}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={cn("w-2.5 h-2.5 rounded-full", meta.dot)} />
          <p className="font-semibold text-neutral-900">{meta.label}</p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-neutral-900">{count}</span>
      </div>
      <p className="text-[11px] uppercase tracking-wide text-neutral-500">{meta.sub}</p>
      <div className="mt-3 h-2 rounded-full bg-white/70 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, delay: delay + 0.1, ease: "easeOut" }}
          className={cn("h-full rounded-full", meta.bar)}
        />
      </div>
      <p className="mt-3 text-xs text-neutral-600 leading-snug">{meta.description}</p>
      <p className="mt-1 text-[11px] text-neutral-400">{pct}% of saved words</p>
    </motion.div>
  );
};
