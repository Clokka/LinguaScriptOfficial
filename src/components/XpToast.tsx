// MOTIVATION LAYER — floating +XP feedback.
import { useEffect, useState } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { useXp } from "@/contexts/XpContext";
import { XpAction } from "@/lib/xp";
import { cn } from "@/lib/utils";

const LABELS: Record<XpAction, string> = {
  add_word: "Word saved",
  review_card: "Nice recall",
  session_end: "Session bonus",
  video_watch: "Video watched",
  reinforcement: "Reinforcement",
};

export const XpToast = () => {
  const { recentGain, leveledUpTo, consumeLevelUp } = useXp();
  const [visible, setVisible] = useState<{
    amount: number;
    action: XpAction;
    key: number;
  } | null>(null);

  useEffect(() => {
    if (!recentGain) return;
    setVisible(recentGain);
    const t = setTimeout(() => setVisible(null), 1400);
    return () => clearTimeout(t);
  }, [recentGain]);

  useEffect(() => {
    if (leveledUpTo == null) return;
    const t = setTimeout(consumeLevelUp, 3200);
    return () => clearTimeout(t);
  }, [leveledUpTo, consumeLevelUp]);

  return (
    <>
      {/* +XP chip */}
      <div
        className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[100]"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}
      >
        {visible && (
          <div
            key={visible.key}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full",
              "bg-gradient-to-r from-primary to-accent text-white",
              "shadow-glow-primary font-semibold",
              "animate-bounce-in",
            )}
          >
            <Sparkles className="w-4 h-4" />
            <span>+{visible.amount} XP</span>
            <span className="text-xs opacity-80">· {LABELS[visible.action]}</span>
          </div>
        )}
      </div>

      {/* Level-up celebration */}
      {leveledUpTo != null && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
          <div className="glass-panel-strong p-8 text-center animate-bounce-in pointer-events-auto">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-accent flex items-center justify-center shadow-glow-accent">
              <Trophy className="w-8 h-8 text-accent-foreground" />
            </div>
            <div className="text-sm uppercase tracking-widest text-muted-foreground">
              Level up
            </div>
            <div className="text-4xl font-black gradient-text mt-1">
              Level {leveledUpTo}
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              Keep the streak going!
            </p>
          </div>
        </div>
      )}
    </>
  );
};
