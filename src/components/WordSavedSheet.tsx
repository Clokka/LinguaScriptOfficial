// "Saved — it's red now": shown after words arrive from the phone (select text →
// Add to LinguaScript, or Share → LinguaScript). Proof that something happened,
// and — the first time only — the colour journey every word takes:
// red (new) → orange (learning) → green (known) → gold (review due) → blue (100% known).
// Colours from brand/README.md; the ladder itself lives in packages/core/src/review.ts.
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ChameleonMascot } from "@/components/ChameleonMascot";

export interface SavedWord { word: string; translation?: string; isNew: boolean }

const JOURNEY = [
  { color: "#FF3B30", name: "Red", what: "New. You'll meet it in videos and flashcards." },
  { color: "#FF8A00", name: "Orange", what: "Learning. You've got it right once." },
  { color: "#34C759", name: "Green", what: "Known. You remember it." },
  { color: "#FFD54A", name: "Gold", what: "Review time. A quick check so you don't forget." },
  { color: "#2F7BFF", name: "Blue", what: "100% known. It's yours for good." },
];

const SEEN_KEY = "ls.wordJourneySeen";
export function journeySeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function markJourneySeen() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode: show again next time */ }
}

export function WordSavedSheet({ words, onClose }: { words: SavedWord[]; onClose: () => void }) {
  const navigate = useNavigate();
  const firstTime = !journeySeen();
  const fresh = words.filter((w) => w.isNew);
  const close = () => { markJourneySeen(); onClose(); };
  const shown = words.slice(0, 4);

  return (
    <Dialog open={words.length > 0} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm border-[#1E1E23] bg-[#0B0B0D] text-[#F2F2F5]">
        <div className="flex flex-col items-center gap-2 text-center">
          <ChameleonMascot tier="red" className="w-24" />
          <DialogTitle className="text-xl font-extrabold">
            {fresh.length ? `Saved: ${fresh.length === 1 ? "it's red now" : `${fresh.length} new red words`}` : "Already in your words"}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#A1A1AA]">
            {fresh.length ? "Red means new. It's in your flashcards, and it'll light up red whenever it appears in a video." : "You saved this before, so nothing changed."}
          </DialogDescription>
        </div>

        <ul className="flex flex-col gap-2">
          {shown.map((w) => (
            <li key={w.word} className="flex items-center justify-between gap-3 rounded-2xl border border-[#1E1E23] bg-[#131316] px-4 py-3">
              <span translate="no" className="text-lg font-extrabold" style={{ color: w.isNew ? "#FF3B30" : "#A1A1AA" }}>{w.word}</span>
              <span className="truncate text-sm text-[#A1A1AA]">{w.translation || (w.isNew ? "meaning on its way" : "already saved")}</span>
            </li>
          ))}
          {words.length > shown.length && <li className="text-center text-xs text-[#8E8E98]">and {words.length - shown.length} more</li>}
        </ul>

        {/* The journey: full explanation the first time, a compact colour bar after that. */}
        {firstTime ? (
          <ol className="flex flex-col gap-1.5 rounded-2xl border border-[#1E1E23] bg-[#131316] p-3">
            <li className="pb-1 text-xs font-bold uppercase tracking-wider text-[#8E8E98]">How every word grows</li>
            {JOURNEY.map((s, i) => (
              <li key={s.name} className="flex items-start gap-2.5 text-sm">
                <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: s.color, boxShadow: i === 0 ? `0 0 0 3px ${s.color}44` : undefined }} />
                <span><b style={{ color: s.color }}>{s.name}</b> <span className="text-[#A1A1AA]">{s.what}</span></span>
              </li>
            ))}
          </ol>
        ) : (
          <div className="flex items-center gap-1.5" aria-label="Red, then orange, green, gold and blue">
            {JOURNEY.map((s, i) => (
              <span key={s.name} className="h-2 flex-1 rounded-full" style={{ background: s.color, opacity: i === 0 ? 1 : 0.35 }} />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {fresh.length > 0 && (
            <button type="button" onClick={() => { close(); navigate("/flashcards?deck=red"); }}
              className="min-h-12 rounded-full bg-[#34C759] font-extrabold text-[#0B0B0D] hover:bg-[#5EDC7E]">
              Practise {fresh.length === 1 ? "it" : "them"} now
            </button>
          )}
          <button type="button" onClick={close} className="min-h-11 rounded-full border border-[#2A2A30] font-bold text-[#F2F2F5] hover:bg-[#17171B]">
            {fresh.length ? "Keep going" : "OK"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
