import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";
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

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [trainingFilmId, setTrainingFilmId] = useState<string | null>(null);
  const playerRef = useRef<any>(null);

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
