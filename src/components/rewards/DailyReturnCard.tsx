import { useEffect, useRef, useState } from "react";
import { Flame, Gift, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { usePet } from "@/contexts/PetContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { emitRewardsChanged } from "@/lib/rewards";
import { keepStreak, checkAchievements, STREAK_EVENT, type StreakResult } from "@/lib/streak";

/**
 * One calm card, no pop-ups: 🔥 streak → 🎁 small return gift (auto-claimed,
 * chameleon waves) → today's mission. The gift is tiny on purpose; the streak
 * only locks in after one real learning action.
 */
export function DailyReturnCard({ goal, done }: { goal: number; done: number }) {
  const { user } = useAuth();
  const { award } = useXp();
  const { triggerReaction } = usePet();
  const { learningLanguage } = useLanguage();
  const [streak, setStreak] = useState<StreakResult | null>(null);
  const [gift, setGift] = useState<{ gems: number; run: number; fresh: boolean } | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!user || ran.current) return;
    ran.current = true;
    (async () => {
      const [{ data }, s] = await Promise.all([(supabase as any).rpc("claim_return_gift"), keepStreak()]);
      if (s) setStreak(s);
      if (data) {
        const fresh = !data.already;
        setGift({ gems: data.gems, run: data.run, fresh });
        if (fresh) {
          award("return_gift");
          triggerReaction("wave", 2500);
          emitRewardsChanged();
        }
      }
      void checkAchievements(learningLanguage);
    })();
  }, [user, award, triggerReaction, learningLanguage]);

  useEffect(() => {
    const on = (e: Event) => {
      setStreak((e as CustomEvent).detail);
      triggerReaction("celebrate", 2500);
    };
    window.addEventListener(STREAK_EVENT, on);
    return () => window.removeEventListener(STREAK_EVENT, on);
  }, [triggerReaction]);

  if (!user || !gift) return null;
  const kept = !!streak?.kept;
  const n = streak?.streak ?? 0;
  const left = Math.max(0, goal - done);

  return (
    <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-4 grid grid-cols-3 gap-3 text-center">
      <div>
        <Flame className={kept ? "w-6 h-6 mx-auto text-primary" : "w-6 h-6 mx-auto text-muted-foreground"} />
        <p className="font-bold text-foreground">{kept ? n : n + 1} day{(kept ? n : n + 1) === 1 ? "" : "s"}</p>
        <p className="text-[11px] text-muted-foreground">{kept ? "Streak kept" : "1 card keeps it"}</p>
      </div>
      <div>
        {gift.fresh ? <Gift className="w-6 h-6 mx-auto text-primary" /> : <Check className="w-6 h-6 mx-auto text-primary" />}
        <p className="font-bold text-foreground">+{gift.gems} 💎</p>
        <p className="text-[11px] text-muted-foreground">Daily gift · day {gift.run}</p>
      </div>
      <div>
        <p className="text-2xl leading-6">📚</p>
        <p className="font-bold text-foreground">{left > 0 ? `${left} to go` : "Done"}</p>
        <p className="text-[11px] text-muted-foreground">Today's mission</p>
      </div>
    </div>
  );
}
