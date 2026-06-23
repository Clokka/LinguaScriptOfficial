import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { TOUR_STEPS, TourStep, TourStepId } from "@/lib/tourSteps";

interface TourState {
  active: boolean;
  stepIndex: number;
  step: TourStep | null;
  trainingFilmId: string | null;
}

interface TourContextType extends TourState {
  start: (opts: { trainingFilmId: string }) => void;
  advance: () => void;
  end: () => void;
  goTo: (id: TourStepId) => void;
  /** Watch.tsx registers the YT player so the tour can drive it. */
  registerPlayer: (player: any) => void;
  getPlayer: () => any;
}

const TourContext = createContext<TourContextType | null>(null);

export const useTour = () => {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside TourProvider");
  return ctx;
};

// Persist tour state across refresh / accidental navigations so the user
// can never lose their place (and always reach the final "paste a YouTube
// link" step).
const STORAGE_KEY = "ls.tourState.v1";
type PersistedTour = { active: boolean; stepIndex: number; trainingFilmId: string | null };
const loadPersisted = (): PersistedTour | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.stepIndex !== "number") return null;
    return {
      active: !!parsed.active,
      stepIndex: Math.min(Math.max(0, parsed.stepIndex), TOUR_STEPS.length - 1),
      trainingFilmId: parsed.trainingFilmId ?? null,
    };
  } catch {
    return null;
  }
};

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const persisted = typeof window !== "undefined" ? loadPersisted() : null;
  const [active, setActive] = useState<boolean>(persisted?.active ?? false);
  const [stepIndex, setStepIndex] = useState<number>(persisted?.stepIndex ?? 0);
  const [trainingFilmId, setTrainingFilmId] = useState<string | null>(persisted?.trainingFilmId ?? null);
  const playerRef = useRef<any>(null);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ active, stepIndex, trainingFilmId } satisfies PersistedTour),
      );
    } catch { /* ignore */ }
  }, [active, stepIndex, trainingFilmId]);

  const start = useCallback(({ trainingFilmId }: { trainingFilmId: string }) => {
    setTrainingFilmId(trainingFilmId);
    setStepIndex(0);
    setActive(true);
  }, []);

  const advance = useCallback(() => {
    setStepIndex((i) => {
      if (i >= TOUR_STEPS.length - 1) {
        setActive(false);
        return 0;
      }
      return i + 1;
    });
  }, []);

  const end = useCallback(() => {
    setActive(false);
    setStepIndex(0);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const goTo = useCallback((id: TourStepId) => {
    const idx = TOUR_STEPS.findIndex((s) => s.id === id);
    if (idx >= 0) {
      setStepIndex(idx);
      setActive(true);
    }
  }, []);

  const registerPlayer = useCallback((p: any) => {
    playerRef.current = p;
  }, []);
  const getPlayer = useCallback(() => playerRef.current, []);

  const value = useMemo<TourContextType>(
    () => ({
      active,
      stepIndex,
      step: active ? TOUR_STEPS[stepIndex] : null,
      trainingFilmId,
      start,
      advance,
      end,
      goTo,
      registerPlayer,
      getPlayer,
    }),
    [active, stepIndex, trainingFilmId, start, advance, end, goTo, registerPlayer, getPlayer],
  );

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>;
};
