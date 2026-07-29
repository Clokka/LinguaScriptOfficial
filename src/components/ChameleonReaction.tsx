// ChameleonReaction — the mascot moment that fires when a LinguaScript line
// changes state. It is not LinguaScript without the chameleon.
//
//   mode="red"            → a full-green line just gained a NEW (red) word:
//                           the red chameleon pops in.
//   mode="orange-to-green" → the last ORANGE word on an otherwise green line was
//                           upgraded: the chameleon starts orange and transforms
//                           to green (0.7s skin transition + a party wiggle).
//
// Auto-dismisses; purely decorative so it never blocks the video controls.
import { useEffect, useState } from "react";
import { ChameleonMascot, ChameleonTier } from "./ChameleonMascot";

export type ReactionMode = "red" | "orange-to-green";

export function ChameleonReaction({
  mode,
  onDone,
}: {
  mode: ReactionMode;
  onDone: () => void;
}) {
  const [tier, setTier] = useState<ChameleonTier>(mode === "red" ? "red" : "orange");
  const [party, setParty] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const timers: number[] = [];
    if (mode === "orange-to-green") {
      // Beat 1: land as orange. Beat 2: transform to green + celebrate.
      timers.push(window.setTimeout(() => { setTier("green"); setParty(true); }, 620));
    }
    timers.push(window.setTimeout(() => setLeaving(true), mode === "red" ? 1500 : 2200));
    timers.push(window.setTimeout(onDone, mode === "red" ? 1900 : 2600));
    return () => timers.forEach(clearTimeout);
  }, [mode, onDone]);

  const label =
    mode === "red"
      ? "New word caught!"
      : tier === "green"
        ? "Line complete — turned green!"
        : "Almost there…";

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-30 flex -translate-x-1/2 flex-col items-center"
      style={{
        bottom: "calc(100% + 8px)",
        animation: leaving
          ? "ls-cham-react-out 380ms ease-in forwards"
          : "ls-cham-react-in 460ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      <style>{`
        @keyframes ls-cham-react-in {
          0%   { opacity:0; transform:translate(-50%, 26px) scale(0.6); }
          60%  { opacity:1; transform:translate(-50%, -6px) scale(1.06); }
          100% { opacity:1; transform:translate(-50%, 0) scale(1); }
        }
        @keyframes ls-cham-react-out {
          to { opacity:0; transform:translate(-50%, -14px) scale(0.9); }
        }
      `}</style>
      <ChameleonMascot tier={tier} party={party} style={{ width: 140 }} />
      <span
        className="mt-1 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide backdrop-blur transition-colors duration-700"
        style={{
          color: tier === "green" ? "#34C759" : tier === "orange" ? "#FF8A00" : "#FF3B30",
          background: "rgba(0,0,0,0.55)",
          border: `1px solid ${tier === "green" ? "#34C75955" : tier === "orange" ? "#FF8A0055" : "#FF3B3055"}`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
