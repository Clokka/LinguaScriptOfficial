import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { getLanguageLabel } from "@/lib/languages";

/** A jump this big on an early rewatch is the moment worth sharing. */
const MIN_JUMP_POINTS = 20;
const SHARE_WATCHES = [2, 3, 4];

export function isShareworthyJump(watchNumber: number, firstPct: number | null | undefined, newPct: number): boolean {
  return firstPct != null && SHARE_WATCHES.includes(watchNumber) && newPct - firstPct >= MIN_JUMP_POINTS;
}

/**
 * The proud moment after a big comprehension jump on a rewatch: the
 * chameleon turns green and celebrates, the jump in big numbers, and one
 * Share button (the phone's own share sheet). Shown rarely, by design.
 */
export function ComprehensionJumpShare({
  firstPct, newPct, language, filmTitle,
}: { firstPct: number; newPct: number; language: string; filmTitle?: string }) {
  const jump = Math.round(newPct - firstPct);
  const langLabel = getLanguageLabel(language);

  const share = async () => {
    const text = `My ${langLabel} comprehension${filmTitle ? ` of "${filmTitle}"` : ""} jumped from ${Math.round(firstPct)}% to ${Math.round(newPct)}% on LinguaScript 🦎`;
    const url = "https://linguascript.co.uk";
    try {
      if (navigator.share) {
        await navigator.share({ title: "LinguaScript", text, url });
      } else {
        await navigator.clipboard.writeText(`${text} ${url}`);
        toast.success("Copied. Paste it anywhere to share");
      }
    } catch {
      /* the learner closed the share sheet */
    }
  };

  return (
    <div className="relative mb-5 flex items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
      <ChameleonMascot tier="green" party style={{ width: 84 }} className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-4xl font-black tabular-nums text-emerald-300 drop-shadow-[0_0_18px_rgba(52,211,153,0.45)]">
          +{jump}%
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">
          {Math.round(firstPct)}% → {Math.round(newPct)}%
        </p>
      </div>
      <Button size="sm" onClick={share} className="shrink-0 gap-1.5 rounded-full">
        <Share2 className="h-4 w-4" /> Share
      </Button>
    </div>
  );
}
