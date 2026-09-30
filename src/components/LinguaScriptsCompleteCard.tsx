import { Check, Compass } from "lucide-react";

interface LinguaScriptsCompleteCardProps {
  wordsReviewedToday?: number;
  newWordsCaptured?: number;
  onContinueWatching?: () => void;
  onDiscover?: () => void;
}

const GREEN = "#34C759";

/** Same shell as LinguaScriptsPendingAlert so the home card never changes shape. */
export function LinguaScriptsCompleteCard({
  wordsReviewedToday = 0,
  onContinueWatching,
  onDiscover,
}: LinguaScriptsCompleteCardProps) {
  const go = onContinueWatching ?? onDiscover;
  return (
    <div
      className="mb-8 rounded-2xl border p-6"
      style={{ borderColor: `${GREEN}55`, background: `${GREEN}14` }}
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
        LinguaScripts
      </p>
      <h2 className="flex items-center gap-2 text-2xl font-extrabold leading-tight text-white">
        <span
          className="inline-flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: GREEN }}
        >
          <Check className="h-4 w-4 text-black" strokeWidth={3} />
        </span>
        All done for today
      </h2>
      <p className="mt-2 text-sm text-white/60">
        <span style={{ color: GREEN }} className="font-semibold">{wordsReviewedToday}</span> word
        {wordsReviewedToday !== 1 ? "s" : ""} reviewed · next reviews come back when they're due
      </p>
      {go && (
        <button
          onClick={go}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border py-3 font-bold transition-opacity hover:opacity-90"
          style={{ borderColor: `${GREEN}66`, color: GREEN }}
        >
          <Compass className="h-4 w-4" /> Find something to watch
        </button>
      )}
    </div>
  );
}
