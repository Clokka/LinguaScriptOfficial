// Daily watch-time gate: goal of N words = N minutes of watching per day.
// Once today's watch time reaches the goal, the video pauses and learners
// must leave the player — to review their cards or go back — like the demo.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Layers } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";

const key = () => `ls-watch-seconds-${new Date().toISOString().slice(0, 10)}`;

interface Props {
  goal: number; // words per day == minutes per day
  playerRef: React.MutableRefObject<any>;
}

export function WatchGoalGate({ goal, playerRef }: Props) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const secondsRef = useRef<number>(Number(localStorage.getItem(key()) || 0));
  const limit = Math.max(1, goal) * 60;

  useEffect(() => {
    const id = setInterval(() => {
      let playing = false;
      try { playing = playerRef.current?.getPlayerState?.() === 1; } catch { /* noop */ }
      if (!playing) return;
      secondsRef.current += 1;
      localStorage.setItem(key(), String(secondsRef.current));
      if (secondsRef.current >= limit) {
        try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ }
        setOpen(true);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [limit, playerRef]);

  // Keep the video paused while the gate is up.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      try { playerRef.current?.pauseVideo?.(); } catch { /* noop */ }
    }, 500);
    return () => clearInterval(id);
  }, [open, playerRef]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/90 backdrop-blur-md p-6">
      <div className="w-full max-w-sm rounded-2xl border border-[#34C759]/40 bg-card p-6 text-center">
        <div className="flex justify-center"><BrandMark variant="pin" size={48} /></div>
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[#34C759]">
          Daily watch goal done
        </p>
        <h2 className="mt-1 text-2xl font-bold text-foreground">
          {goal} {goal === 1 ? "minute" : "minutes"} watched today
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Time to lock in your words. Review your cards to turn them green.
        </p>
        <button
          onClick={() => navigate("/linguascript")}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#34C759] py-3 font-semibold text-background"
        >
          <Layers className="h-5 w-5" /> Review cards
        </button>
        <button
          onClick={() => navigate("/discover")}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-border py-3 font-semibold text-foreground"
        >
          <ArrowLeft className="h-5 w-5" /> Back
        </button>
      </div>
    </div>,
    document.body,
  );
}
