import { useState } from "react";
import { Download, ClipboardCopy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyForQuizlet, downloadAnki, QUIZLET_CREATE_URL, type ExportCard } from "@/lib/deckExport";

/** "Save to Anki" + "Save to Quizlet" for any list of words. */
export function ExportDeckButtons({ cards, deckName }: { cards: ExportCard[]; deckName: string }) {
  const [copied, setCopied] = useState<"ok" | "blocked" | null>(null);
  const disabled = cards.length === 0;

  const quizlet = async () => {
    const ok = await copyForQuizlet(cards);
    setCopied(ok ? "ok" : "blocked");
    if (ok) window.open(QUIZLET_CREATE_URL, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled} onClick={() => downloadAnki(cards, deckName)}>
          <Download className="h-4 w-4" /> Save to Anki
        </Button>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled} onClick={quizlet}>
          {copied === "ok" ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} Save to Quizlet
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {copied === "ok"
          ? "Copied! In Quizlet, tap “Import” and paste. Choose “Tab” between word and meaning."
          : copied === "blocked"
            ? "Your browser blocked copying. Use “Save to Anki”: the file also imports into Quizlet."
            : "Anki: open the file with File → Import. Quizlet: we copy the words, then you paste them into “Import”."}
      </p>
    </div>
  );
}
