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
  xpForAction,
  xpForLevel,
} from "@/lib/xp";
import type { SpikeIntensity } from "@/lib/dailyGoalSpike";

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
  recentGain: RecentGain | null;
  leveledUpTo: number | null;
  /** Set only when the level-up came from reaching today's word goal — how
   *  big the celebration should feel, never how much it pays (see
   *  dailyGoalSpike.ts). Null for an ordinary XP level-up. */
  spikeIntensity: SpikeIntensity | null;
  award: (action: XpAction, meta?: XpMeta & { intensity?: SpikeIntensity }) => number;
  consumeLevelUp: () => void;
}

const XpContext = createContext<XpContextValue | undefined>(undefined);

export function XpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [xp, setXp] = useState<number>(0);
  const [recentGain, setRecentGain] = useState<RecentGain | null>(null);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);
  const [spikeIntensity, setSpikeIntensity] = useState<SpikeIntensity | null>(null);
  const prevLevelRef = useRef<number>(1);
  // Mirrors `xp` synchronously so award() can compute the next total without
  // doing side effects inside a state updater (updaters must stay pure).
  const xpRef = useRef<number>(0);

  // Awards still being saved; the server total is only trusted once none are
  // in flight, otherwise an earlier reply would briefly undo a later award.
  const pendingRef = useRef(0);

  const applyXp = useCallback((value: number) => {
    xpRef.current = value;
    setXp(value);
  }, []);

  // Adopt the server's total (it may include XP from another tab or device).
  // Levels gained elsewhere are absorbed silently — no popup for them here.
  const reconcile = useCallback((serverTotal: number | null) => {
    if (serverTotal == null || pendingRef.current > 0 || serverTotal === xpRef.current) return;
    applyXp(serverTotal);
    prevLevelRef.current = levelFromXP(serverTotal).level;
  }, [applyXp]);

  // A tab left open overnight would otherwise keep showing yesterday's XP.
  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      const { data } = await supabase
        .from("profiles")
        .select("xp_total")
        .eq("user_id", user.id)
        .maybeSingle();
      const dbXp = data?.xp_total;
      if (typeof dbXp === "number") reconcile(dbXp);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [user, reconcile]);

  // Load XP on auth changes
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        const guest = getGuestXP();
        if (alive) {
          applyXp(guest);
          prevLevelRef.current = levelFromXP(guest).level;
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("xp_total")
        .eq("user_id", user.id)
        .maybeSingle();
      const dbXp = data?.xp_total ?? 0;

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
        await persistXP(user.id, total, "add_word", guest, { cards: 0 });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const award = useCallback(
    (action: XpAction, meta?: XpMeta & { intensity?: SpikeIntensity }) => {
      // Reaching today's word goal is a guaranteed level-up, not a fixed XP
      // grant — the bonus is exactly whatever's left to the next threshold,
      // so it works the same way whether today's goal was 1 word or 20.
      const amount =
        action === "daily_goal_reached"
          ? Math.max(1, xpForLevel(levelFromXP(xpRef.current).level + 1) - xpRef.current)
          : xpForAction(action, meta);
      if (amount <= 0) return 0;

      const next = xpRef.current + amount;
      const { level } = levelFromXP(next);
      applyXp(next);

      if (level > prevLevelRef.current) {
        prevLevelRef.current = level;
        setLeveledUpTo(level);
        try { localStorage.setItem("ls.lastLevelUpDay", new Date().toLocaleDateString("en-CA")); } catch { /* ignore */ }
        setSpikeIntensity(action === "daily_goal_reached" ? (meta?.intensity ?? "normal") : null);
      }

      if (user) {
        pendingRef.current += 1;
        void persistXP(user.id, next, action, amount, meta).then((serverTotal) => {
          pendingRef.current -= 1;
          reconcile(serverTotal);
        });
      } else {
        setGuestXP(next);
      }
      setRecentGain({ amount, action, key: Date.now() + Math.random() });
      return amount;
    },
    [user, applyXp, reconcile],
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
        recentGain,
        leveledUpTo,
        spikeIntensity,
        award,
        consumeLevelUp: () => {
          setLeveledUpTo(null);
          setSpikeIntensity(null);
        },
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
