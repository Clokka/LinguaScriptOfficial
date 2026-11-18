// "Export" on /vocabulary: the words shown (current language + deck filter) to
// Anki (CSV with Anki headers, re-import updates the same notes) or Quizlet
// (copied as word<TAB>meaning lines, Quizlet's default import format).
import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { getGuestWords } from "@/lib/guestWords";
import { track } from "@/lib/analytics";
import { toAnkiCsv, toQuizletText, type ExportWord } from "@linguascript/core/export";

type Filter = "all" | "red" | "orange" | "green";

async function loadWords(user: User | null, language: string, filter: Filter): Promise<ExportWord[]> {
  if (!user) {
    // Guest words are all new (red) until they sign up.
    return filter === "all" || filter === "red"
      ? getGuestWords().filter((g) => g.language === language).map((g) => ({ id: g.id, word: g.word, translation: g.translation, language: g.language, context: g.context, state: "red" }))
      : [];
  }
  const rows: ExportWord[] = [];
  for (let from = 0; ; from += 1000) {
    let q = supabase.from("saved_words")
      .select("id, word, translation, language, context, context_translation, state, next_review, interval_days, state_changed_at, green_revealed_at")
      .eq("user_id", user.id).eq("language", language)
      .order("created_at", { ascending: false }).range(from, from + 999);
    if (filter !== "all") q = q.eq("state", filter);
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...((data as ExportWord[]) || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportWordsMenu({ user, language, filter }: { user: User | null; language: string; filter: Filter }) {
  const [busy, setBusy] = useState(false);
  const label = filter === "all" ? "all" : filter;

  const run = async (to: "anki" | "quizlet") => {
    setBusy(true);
    try {
      const words = await loadWords(user, language, filter);
      if (!words.length) { toast("No words to export yet. Save some words while you watch first."); return; }
      if (to === "anki") {
        download(`linguascript-${language}-${label}.csv`, toAnkiCsv(words), "text/csv;charset=utf-8");
        toast.success(`Exported ${words.length} words for Anki`, { description: "In Anki: File → Import → choose the file → Import." });
      } else {
        const text = toQuizletText(words);
        let copied = false;
        try { await navigator.clipboard.writeText(text); copied = true; } catch { /* clipboard blocked: download instead */ }
        if (!copied) download(`linguascript-${language}-${label}-quizlet.txt`, text, "text/plain;charset=utf-8");
        toast.success(copied ? `Copied ${words.length} words for Quizlet` : `Downloaded ${words.length} words for Quizlet`, {
          description: "In Quizlet: Create → Flashcard set → Import → paste. Keep Tab and New line selected.",
        });
      }
      track("words_exported", { to, count: words.length, filter, language });
    } catch {
      toast.error("Couldn't export your words. Please try again.");
    } finally { setBusy(false); }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 rounded-full" disabled={busy}>
          <Download className="w-4 h-4" /> {busy ? "Exporting…" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Exports {filter === "all" ? "all your words" : `your ${filter} words`} in this language
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void run("anki")}>
          <span className="flex flex-col"><span className="font-semibold">Anki</span><span className="text-xs text-muted-foreground">CSV file · word, meaning + sentence</span></span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void run("quizlet")}>
          <span className="flex flex-col"><span className="font-semibold">Quizlet</span><span className="text-xs text-muted-foreground">Copies your words to paste into Import</span></span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/words/anki-and-quizlet#export" className="text-xs text-muted-foreground">How to import →</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
