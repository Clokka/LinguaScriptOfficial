import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useXp } from "@/contexts/XpContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { DECK_COLOURS, type DeckState } from "@linguascript/core/review";
import { saveScannedWords } from "@linguascript/core/vocab";
import { track } from "@/lib/analytics";

/**
 * 📷 Scan a page: photograph a book page where you circled (or highlighted)
 * words → they go into your decks. Pen circle/underline = red; highlighter
 * red → red, orange/yellow → orange, green → green. The reading is done by the
 * scan-page function; you see the list first and can untick misreads.
 */
interface Found {
  word: string; lemma: string; translation: string; context: string;
  mark: "circle" | "underline" | "highlight"; colour: string; deck: DeckState;
}

const DECK_LABEL: Record<DeckState, string> = { red: "Red", orange: "Orange", green: "Green" };
const NEXT: Record<DeckState, DeckState> = { red: "orange", orange: "green", green: "red" };

/** Shrink the photo before upload: phone photos are 3–12 MB, the AI only needs ~1600px. */
async function toDataUrl(file: File, max = 1600): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(async () => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  });
  const w = "width" in bitmap ? bitmap.width : 0;
  const h = "height" in bitmap ? bitmap.height : 0;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d")!.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function ScanPageButton({ onSaved, className }: { onSaved?: () => void; className?: string }) {
  const { user } = useAuth();
  const { award } = useXp();
  const { learningLanguage } = useLanguage();
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"reading" | "saving" | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [found, setFound] = useState<(Found & { keep: boolean })[]>([]);
  const [lang, setLang] = useState("");

  const pick = () => {
    if (!user) { toast("Log in to save words from a photo"); return; }
    input.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file || !user) return;
    setOpen(true);
    setFound([]);
    setBusy("reading");
    track("page_scan_started", { language: learningLanguage });
    try {
      const image = await toDataUrl(file);
      setPreview(image);
      const { data: prof } = await supabase.from("profiles").select("native_language").eq("user_id", user.id).maybeSingle();
      const nativeLanguage = String((prof as any)?.native_language || "en").toLowerCase();
      const { data, error } = await supabase.functions.invoke("scan-page", {
        body: { image, language: learningLanguage, nativeLanguage },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const words: Found[] = (data as any)?.words || [];
      setLang(String((data as any)?.language || learningLanguage || "").toLowerCase());
      setFound(words.map((w) => ({ ...w, keep: true })));
      track("page_scanned", { language: learningLanguage, found: words.length });
    } catch (e) {
      toast.error(`Couldn't read that photo: ${(e as Error).message || "try again"}`);
      setOpen(false);
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  };

  const save = async () => {
    if (!user) return;
    const language = learningLanguage || lang;
    const keep = found.filter((w) => w.keep);
    if (!keep.length || !language) { setOpen(false); return; }
    setBusy("saving");
    try {
      const { added, moved } = await saveScannedWords(supabase as any, user.id, language, keep, (w) => {
        award("add_word");
        track("word_saved", { language, source: "page_scan", deck: w.deck, mark: w.mark });
      });
      toast.success(`📷 ${added} word${added === 1 ? "" : "s"} added${moved ? `, ${moved} moved up` : ""}`);
      setOpen(false);
      onSaved?.();
    } finally {
      setBusy(null);
    }
  };

  const kept = found.filter((w) => w.keep).length;

  return (
    <>
      <Button variant="outline" onClick={pick} className={className}>
        <Camera className="w-4 h-4 mr-2" /> Scan a page
      </Button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>📷 Words from your page</DialogTitle>
            <DialogDescription>
              Circled or underlined go red. Highlighter goes in its colour: red, orange (or yellow), green. Tap a colour to change it, untick a word to skip it.
            </DialogDescription>
          </DialogHeader>

          {busy === "reading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              {preview && <img src={preview} alt="Your page" className="max-h-40 rounded-lg opacity-60" />}
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Finding your circled words…</p>
            </div>
          )}

          {!busy && found.length === 0 && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No marked words found. Circle words clearly in pen, and take the photo straight on in good light.
            </p>
          )}

          {found.length > 0 && (
            <ul className="space-y-2">
              {found.map((w, i) => (
                <li key={w.word} className={`flex items-start gap-3 rounded-xl border border-border p-3 ${w.keep ? "" : "opacity-40"}`}>
                  <input
                    id={`scan-${i}`}
                    type="checkbox"
                    checked={w.keep}
                    onChange={() => setFound((f) => f.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                    className="mt-1.5 h-4 w-4"
                  />
                  <label htmlFor={`scan-${i}`} className="flex-1 min-w-0">
                    <span className="font-semibold" style={{ color: DECK_COLOURS[w.deck].hex }} translate="no">{w.word}</span>
                    {w.translation && <span className="text-muted-foreground"> — {w.translation}</span>}
                    {w.context && <span className="block text-xs text-muted-foreground mt-0.5 truncate" translate="no">« {w.context} »</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => setFound((f) => f.map((x, j) => (j === i ? { ...x, deck: NEXT[x.deck] } : x)))}
                    className="shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                    style={{ background: DECK_COLOURS[w.deck].deep }}
                    title="Change deck"
                  >
                    {DECK_LABEL[w.deck]}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {found.length > 0 && (
            <Button onClick={save} disabled={!!busy || kept === 0} className="w-full mt-2">
              {busy === "saving" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save {kept} word{kept === 1 ? "" : "s"}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
