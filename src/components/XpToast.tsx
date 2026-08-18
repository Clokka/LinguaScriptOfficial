// MOTIVATION LAYER — floating +XP feedback.
// Word saves and level-ups spawn the 3D pet celebration; other XP actions
// keep the lightweight chip. Falls back to the chip when no pet is equipped
// or the user prefers reduced motion.
import { lazy, Suspense, useEffect, useState } from "react";
import { Gem, Sparkles, Trophy } from "lucide-react";
import { useXp } from "@/contexts/XpContext";
import { XpAction } from "@/lib/xp";
import { nextGemUnlock } from "@/lib/levelRewards";
import { cn } from "@/lib/utils";
import { usePet } from "@/contexts/PetContext";
import {
  WORD_SAVED_DURATION_MS,
  levelUpDurationMs,
} from "@/components/pets/PetCelebration";

const WordSavedCelebration = lazy(() =>
  import("@/components/pets/PetCelebration").then((m) => ({
    default: m.WordSavedCelebration,
  })),
);
const LevelUpCelebration = lazy(() =>
  import("@/components/pets/PetCelebration").then((m) => ({
    default: m.LevelUpCelebration,
  })),
);

const LABELS: Record<XpAction, string> = {
  add_word: "Word saved",
  review_card: "Nice recall",
  session_end: "Session bonus",
  video_watch: "Video watched",
  reinforcement: "Reinforcement",
};

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export const XpToast = () => {
  const {
    recentGain,
    leveledUpTo,
    levelUpReward,
    gems,
    consumeLevelUp,
    award,
  } = useXp();
  const { activePet, triggerReaction, petCollection } = usePet();
  const nextUnlock = nextGemUnlock(gems, petCollection);
  const [visible, setVisible] = useState<{
    amount: number;
    action: XpAction;
    key: number;
  } | null>(null);

  const petCelebrations = activePet != null && !prefersReducedMotion();

  // Warm up the celebration chunk + active pet model so the first
  // spawn is instant instead of stuttering on network fetches.
  useEffect(() => {
    if (!petCelebrations) return;
    void import("@/components/pets/PetCelebration").then((m) =>
      m.preloadPetModel(activePet),
    );
  }, [activePet, petCelebrations]);

  useEffect(() => {
    if (!recentGain) return;
    setVisible(recentGain);
    const isPetSpawn = petCelebrations && recentGain.action === "add_word";
    const t = setTimeout(
      () => setVisible(null),
      isPetSpawn ? WORD_SAVED_DURATION_MS : 1400,
    );
    return () => clearTimeout(t);
    // petCelebrations is intentionally not a dep: changing it mid-toast
    // shouldn't restart the dismiss timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentGain]);

  useEffect(() => {
    if (leveledUpTo == null) return;
    // Duration follows the level: the ramp's later celebrations hold longer.
    const ms = levelUpDurationMs(leveledUpTo);
    triggerReaction("excited", ms);
    const t = setTimeout(consumeLevelUp, ms);
    return () => clearTimeout(t);
  }, [leveledUpTo, consumeLevelUp, triggerReaction]);

  const petWordSpawn =
    petCelebrations && visible?.action === "add_word" ? visible : null;

  return (
    <>
      {/* Word saved — 3D pet spawn toast (non-blocking, bottom-right) */}
      {petWordSpawn && activePet && (
        <Suspense fallback={null}>
          <WordSavedCelebration
            key={petWordSpawn.key}
            petId={activePet}
            amount={petWordSpawn.amount}
            label={LABELS[petWordSpawn.action]}
          />
        </Suspense>
      )}

      {/* +XP chip for everything else */}
      <div
        className="pointer-events-none fixed left-1/2 -translate-x-1/2 z-[100]"
        style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 90px)" }}
      >
        {visible && !petWordSpawn && (
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
      {leveledUpTo != null &&
        (petCelebrations && activePet ? (
          <Suspense fallback={null}>
            <LevelUpCelebration petId={activePet} level={leveledUpTo} />
          </Suspense>
        ) : (
          <div className="fixed inset-0 z-[110] flex items-center justify-center pointer-events-none">
            <div className="glass-panel-strong p-8 text-center animate-bounce-in pointer-events-auto">
              <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gradient-accent flex items-center justify-center shadow-glow-accent">
                <Trophy className="w-8 h-8 text-accent-foreground" />
              </div>
              <div className="text-sm uppercase tracking-widest text-muted-foreground">
                {levelUpReward?.tier === "grand"
                  ? "Grand milestone"
                  : levelUpReward?.tier === "major"
                    ? "Milestone"
                    : "Level up"}
              </div>
              <div className="text-4xl font-black gradient-text mt-1">
                Level {leveledUpTo}
              </div>

              {levelUpReward && levelUpReward.gems > 0 && (
                <>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/10 px-4 py-2">
                    <Gem className="w-4 h-4 text-accent" />
                    <span className="font-bold tabular-nums text-foreground">
                      +{levelUpReward.gems.toLocaleString()} Gems
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {levelUpReward.blurb}
                  </p>
                </>
              )}

              {nextUnlock && (
                <p className="text-xs text-muted-foreground mt-3">
                  {nextUnlock.remaining.toLocaleString()} more gems unlocks{" "}
                  <span className="text-foreground font-medium">
                    {nextUnlock.pet.emoji} {nextUnlock.pet.name}
                  </span>
                </p>
              )}
            </div>
          </div>
        ))}

      {/* Dev-only preview triggers: open any page with ?petdemo=1 */}
      {import.meta.env.DEV &&
        new URLSearchParams(window.location.search).has("petdemo") && (
          <div className="fixed bottom-4 left-4 z-[120] flex gap-2">
            <button
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow"
              onClick={() => award("add_word")}
            >
              Demo: save word (+20 XP)
            </button>
          </div>
        )}
    </>
  );
};
