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
} from "@/lib/xp";

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
  award: (action: XpAction, meta?: XpMeta) => number;
  consumeLevelUp: () => void;
}

const XpContext = createContext<XpContextValue | undefined>(undefined);

export function XpProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [xp, setXp] = useState<number>(0);
  const [recentGain, setRecentGain] = useState<RecentGain | null>(null);
  const [leveledUpTo, setLeveledUpTo] = useState<number | null>(null);
  const prevLevelRef = useRef<number>(1);

  // Load XP on auth changes
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!user) {
        const guest = getGuestXP();
        if (alive) {
          setXp(guest);
          prevLevelRef.current = levelFromXP(guest).level;
        }
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("xp_total")
        .eq("user_id", user.id)
        .maybeSingle();
      const dbXp = ((data as any)?.xp_total as number | undefined) ?? 0;
      // Merge any guest XP earned before sign-in.
      const guest = getGuestXP();
      if (guest > 0) {
        const merged = dbXp + guest;
        clearGuestXP();
        if (alive) {
          setXp(merged);
          prevLevelRef.current = levelFromXP(merged).level;
        }
        const { level } = levelFromXP(merged);
        await persistXP(user.id, merged, level, "add_word", guest, {
          cards: 0,
        });
      } else if (alive) {
        setXp(dbXp);
        prevLevelRef.current = levelFromXP(dbXp).level;
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const award = useCallback(
    (action: XpAction, meta?: XpMeta) => {
      const amount = xpForAction(action, meta);
      if (amount <= 0) return 0;
      setXp((prev) => {
        const next = prev + amount;
        const { level } = levelFromXP(next);
        if (level > prevLevelRef.current) {
          setLeveledUpTo(level);
          prevLevelRef.current = level;
        }
        if (user) {
          void persistXP(user.id, next, level, action, amount, meta);
        } else {
          setGuestXP(next);
        }
        return next;
      });
      setRecentGain({ amount, action, key: Date.now() + Math.random() });
      return amount;
    },
    [user],
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
