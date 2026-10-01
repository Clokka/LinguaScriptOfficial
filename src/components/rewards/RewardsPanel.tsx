import { useCallback, useEffect, useState } from "react";
import { Gem, Gift, Lock, Check, Flame, Snowflake, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadRewardState,
  levelBoxContents,
  openLevelBox,
  claimStreakReward,
  STREAK_MILESTONES,
  REWARDS_CHANGED,
  emitRewardsChanged,
} from "@/lib/rewards";
import { GiftBoxReveal, type GiftContents } from "./GiftBoxReveal";
import { GemShop } from "./GemShop";
import { AchievementCosmetics } from "./AchievementCosmetics";

type State = Awaited<ReturnType<typeof loadRewardState>>;

export function RewardsPanel() {
  const { user } = useAuth();
  const [s, setS] = useState<State | null>(null);
  const [gift, setGift] = useState<{ contents: GiftContents; run: () => Promise<void> } | null>(null);
  const [shopOpen, setShopOpen] = useState(false);

  const load = useCallback(async () => {
    if (user) setS(await loadRewardState(user.id));
  }, [user]);

  useEffect(() => {
    void load();
    window.addEventListener(REWARDS_CHANGED, load);
    return () => window.removeEventListener(REWARDS_CHANGED, load);
  }, [load]);

  if (!s) return null;

  const unopened: number[] = [];
  for (let l = 2; l <= s.level; l++) if (!s.claimed.has(`level:${l}`)) unopened.push(l);
  const upcoming = Array.from({ length: 5 }, (_, i) => s.level + 1 + i);

  const openBox = (level: number) => {
    const c = levelBoxContents(level);
    setGift({
      contents: { title: `Level ${level} gift`, gems: c.gems, item: c.item },
      run: async () => {
        await openLevelBox(level);
        emitRewardsChanged();
      },
    });
  };

  const claimStreak = (m: (typeof STREAK_MILESTONES)[number]) =>
    setGift({
      contents: { title: `${m.days}-day streak`, gems: m.gems, item: m.item },
      run: async () => {
        await claimStreakReward(m.days);
        emitRewardsChanged();
      },
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">🎁 Rewards</p>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Gem className="w-4 h-4 text-accent" /> {s.gems}
          </span>
          <span className="inline-flex items-center gap-1 tabular-nums" title="Streak freezes">
            <Snowflake className="w-4 h-4 text-primary" /> {s.freezes}/2
          </span>
        </div>
      </div>

      {unopened.length > 0 && (
        <Button onClick={() => openBox(unopened[0])} className="w-full gap-2">
          <Gift className="w-4 h-4" /> Open level {unopened[0]} gift
          {unopened.length > 1 && ` (+${unopened.length - 1} more)`}
        </Button>
      )}

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Next level gifts</p>
        <div className="grid grid-cols-5 gap-2">
          {upcoming.map((l) => {
            const c = levelBoxContents(l);
            return (
              <div key={l} className="rounded-xl border border-border/50 bg-secondary/30 p-2 text-center">
                <p className="text-[10px] text-muted-foreground">Lv {l}</p>
                <p className="text-xl leading-7">{c.item?.emoji ?? "💎"}</p>
                <p className="text-[10px] tabular-nums text-foreground">{c.gems}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
          <Flame className="w-3 h-3" /> Streak rewards · {s.streak} days
        </p>
        <div className="grid grid-cols-6 gap-2">
          {STREAK_MILESTONES.map((m) => {
            const claimed = s.claimed.has(`streak:${m.days}`);
            const ready = !claimed && s.streak >= m.days;
            return (
              <button
                key={m.days}
                disabled={!ready}
                onClick={() => claimStreak(m)}
                className={cn(
                  "rounded-xl border p-2 text-center",
                  ready ? "border-primary bg-primary/10 animate-pulse" : "border-border/50 bg-secondary/30",
                )}
              >
                <p className="text-[10px] text-muted-foreground">{m.days}d</p>
                <div className="flex justify-center py-1">
                  {claimed ? (
                    <Check className="w-4 h-4 text-primary" />
                  ) : ready ? (
                    <Gift className="w-4 h-4 text-primary" />
                  ) : (
                    <Lock className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <p className="text-[10px] tabular-nums">{m.item?.emoji ?? `${m.gems}`}</p>
              </button>
            );
          })}
        </div>
      </div>

      <Button variant="outline" onClick={() => setShopOpen(true)} className="w-full gap-2">
        <ShoppingBag className="w-4 h-4" /> Gem shop
      </Button>

      <GiftBoxReveal open={!!gift} onClose={() => setGift(null)} contents={gift?.contents ?? null} onOpen={() => gift!.run()} />
      <AchievementCosmetics />
      <GemShop open={shopOpen} onClose={() => setShopOpen(false)} state={s} />
    </div>
  );
}
