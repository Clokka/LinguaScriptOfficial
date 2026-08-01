// MOTIVATION LAYER — independent of SRS.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  XpAction,
  XpMeta,
  getGuestXP,
  setGuestXP,
  clearGuestXP,
  levelFromXP,
  persistXP,
  syncLevelRewards,
  xpForAction,
} from "@/lib/xp";
import { rewardForLevel, type LevelReward } from "@/lib/levelRewards";

interface RecentGain {
  amount: number;
  action: XpAction;
  key: number;
}

interface XpContextValue {
  xp: number;
  level: number;
  levelProgress: number; // 0..1
  current: number;
  nextLevelXP: number;
  gems: number;
  recentGain: RecentGain | null;
  leveledUpTo: number | null;
  /** Reward for the level just reached, for the celebration UI. */
  levelUpReward: LevelReward | null;
  award: (action: XpAction, meta?: XpMeta) => number;
  consumeLevelUp: () => void;
}

const XpContext = createContext<XpContextValue | undefined>(undefined);

export function XpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [xp, setXp] = useState<number>(0);
  const [gems, setGems] = useState<number>(0);
  const [recentGain, setRecentGain] = useState<RecentGain | null>(null);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);
  const prevLevelRef = useRef<number>(1);
  // Mirrors `xp` synchronously so award() can compute the next total without
  // doing side effects inside a state updater (updaters must stay pure).
  const xpRef = useRef<number>(0);

  const applyXp = useCallback((value: number) => {
    xpRef.current = value;
    setXp(value);
  }, []);

  // Load XP on auth changes
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        const guest = getGuestXP();
        if (alive) {
          applyXp(guest);
          setGems(0);
          prevLevelRef.current = levelFromXP(guest).level;
        }
        return;
      }
      // `gems` arrives with the level-rewards migration. Until that migration
      // is applied the column select would error and read back as 0 XP, so
      // fall back to the XP-only select rather than wiping a learner's total.
      let row = await supabase
        .from("profiles")
        .select("xp_total, gems")
        .eq("user_id", user.id)
        .maybeSingle();
      if (row.error) {
        row = await supabase
          .from("profiles")
          .select("xp_total")
          .eq("user_id", user.id)
          .maybeSingle();
      }
      const dbXp = ((row.data as any)?.xp_total as number | undefined) ?? 0;
      if (alive) setGems(((row.data as any)?.gems as number | undefined) ?? 0);

      // Merge any guest XP earned before sign-in.
      const guest = getGuestXP();
      let total = dbXp;
      if (guest > 0) {
        total = dbXp + guest;
        clearGuestXP();
      }
      const { level } = levelFromXP(total);
      if (alive) {
        applyXp(total);
        prevLevelRef.current = level;
      }
      if (guest > 0) {
        await persistXP(user.id, total, level, "add_word", guest, { cards: 0 });
      }

      // Back-fill any level rewards never granted (including levels that were
      // unreachable while the curve was capped). Silent: past levels are paid
      // out but not celebrated — only new level-ups get a popup.
      const balance = await syncLevelRewards(level);
      if (alive && balance != null) setGems(balance);
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const award = useCallback(
    (action: XpAction, meta?: XpMeta) => {
      const amount = xpForAction(action, meta);
      if (amount <= 0) return 0;

      const next = xpRef.current + amount;
      const { level } = levelFromXP(next);
      applyXp(next);

      if (level > prevLevelRef.current) {
        prevLevelRef.current = level;
        setLeveledUpTo(level);
        if (user) {
          // Server grants the reward idempotently and returns the balance,
          // so a replayed level-up can never double-pay.
          void syncLevelRewards(level).then((balance) => {
            if (balance != null) setGems(balance);
          });
        }
      }

      if (user) {
        void persistXP(user.id, next, level, action, amount, meta);
      } else {
        setGuestXP(next);
      }
      setRecentGain({ amount, action, key: Date.now() + Math.random() });
      return amount;
    },
    [user, applyXp],
  );

  const { level, current, nextLevelXP } = levelFromXP(xp);
  const levelProgress =
    nextLevelXP > 0 ? Math.min(1, Math.max(0, current / nextLevelXP)) : 0;

  return (
    <XpContext.Provider
      value={{
        xp,
        level,
        current,
        nextLevelXP,
        levelProgress,
        gems,
        recentGain,
        leveledUpTo,
        levelUpReward: leveledUpTo != null ? rewardForLevel(leveledUpTo) : null,
        award,
        consumeLevelUp: () => setLeveledUpTo(null),
      }}
    >
      {children}
    </XpContext.Provider>
  );
}

export function useXp() {
  const ctx = useContext(XpContext);
  if (!ctx) throw new Error("useXp must be used within XpProvider");
  return ctx;
}
