import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { SiteToAppMessage } from "@linguascript/core/bridge";

/**
 * "🦎 Colour words on my phone" — the Android bubble (mobile/plugins/withWordBubble.js).
 * Shown only inside the Android app. The app turns the bubble on/off; the
 * website only remembers the choice for this switch.
 */
const KEY = "ls.phoneBubble";
const toApp = (msg: SiteToAppMessage) => {
  try { (window as any).ReactNativeWebView?.postMessage(JSON.stringify(msg)); } catch { /* not in the app */ }
};

export function PhoneBubbleSetting() {
  const { pathname } = useLocation();
  const inAndroidApp = typeof window !== "undefined" && !!(window as any).ReactNativeWebView && /Android/i.test(navigator.userAgent);
  const [on, setOn] = useState(false);
  const [style, setStyle] = useState<"text" | "ring" | "common">("text");
  const [gold, setGold] = useState(false);
  const [subtitles, setSubtitles] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      setOn(!!saved.on);
      if (saved.style === "ring" || saved.style === "common") setStyle(saved.style);
      setGold(!!saved.gold);
      setSubtitles(!!saved.subtitles);
    } catch { /* ignore */ }
  }, []);

  // On the website the switch can't reach the phone — say where it lives.
  if (!inAndroidApp) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 space-y-1">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>🦎</span>
          <p className="flex-1 font-semibold">Colour words on my phone</p>
        </div>
        <p className="text-sm text-muted-foreground">
          Tap any subtitle word in the YouTube app for its meaning. No button, just tap the word. Turn it on here inside the LinguaScript Android app.
          {pathname !== "/overlay" && (
            <> <Link to="/overlay" className="text-primary underline">How it works</Link></>
          )}
        </p>
      </section>
    );
  }

  const save = (next: { on: boolean; style: "text" | "ring" | "common" }) => {
    setOn(next.on);
    setStyle(next.style);
    try { localStorage.setItem(KEY, JSON.stringify({ ...next, gold, subtitles })); } catch { /* ignore */ }
    toApp({ type: "bubble", on: next.on, style: next.style });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      {/* 🎬 Tap a subtitle word in the YouTube app — no bubble (SubtitleTapService.kt). */}
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>🎬</span>
        <label htmlFor="phone-subtitles" className="flex-1">
          <span className="block font-semibold">Tap YouTube subtitles</span>
          <span className="block text-sm text-muted-foreground">
            Turn subtitles on in YouTube and tap any word for its meaning. The video pauses and plays again after.
            Android asks once to “share your screen”. Say yes: we only read the subtitles, on your phone.
          </span>
        </label>
        <Switch
          id="phone-subtitles"
          checked={subtitles}
          onCheckedChange={(v) => {
            setSubtitles(v);
            try { localStorage.setItem(KEY, JSON.stringify({ on, style, gold, subtitles: v })); } catch { /* ignore */ }
            toApp({ type: "subtitles", on: v });
            track(v ? "phone_subtitles_enabled" : "phone_subtitles_disabled");
          }}
        />
      </div>

      <div className="flex items-center gap-3 border-t border-border pt-3">
        <span className="text-2xl" aria-hidden>🦎</span>
        <label htmlFor="phone-bubble" className="flex-1 font-semibold">Colour words on my phone</label>
        <Switch
          id="phone-bubble"
          checked={on}
          onCheckedChange={(v) => { save({ on: v, style }); track(v ? "phone_colour_enabled" : "phone_colour_disabled", { style }); }}
        />
      </div>
      <p className="text-sm text-muted-foreground">Word style: colour the words red, orange, green and gold, draw rings around them, or colour them and ring the common words you haven't saved yet.</p>
      {(
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Word style">
          {(["text", "ring", "common"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={style === s}
              onClick={() => { save({ on, style: s }); track("phone_colour_style", { style: s }); }}
              className={`h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 ${style === s ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {s === "common" ? (
                <span><b style={{ color: "#34C759" }}>A</b><b className="inline-block rounded-full border-2 px-0.5 leading-none" style={{ borderColor: "#FFD54A" }}>a</b></span>
              ) : s === "text" ? (
                <span><b style={{ color: "#FF3B30" }}>A</b><b style={{ color: "#FF8A00" }}>a</b><b style={{ color: "#34C759" }}>a</b><b style={{ color: "#FFD54A" }}>a</b></span>
              ) : (
                <span className="flex gap-0.5">{["#FF3B30", "#FF8A00", "#34C759", "#FFD54A"].map((c) => <i key={c} className="block w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: c }} />)}</span>
              )}
              {s === "text" ? "Colour" : s === "ring" ? "Rings" : "Common words"}
            </button>
          ))}
        </div>
      )}

      {/* ✨ Lock screen: only GOLD words — reviews of words you already know (GoldWords.kt). */}
      <div className="flex items-center gap-3 border-t border-border pt-3">
        <span className="text-2xl" aria-hidden>✨</span>
        <label htmlFor="phone-gold" className="flex-1">
          <span className="block font-semibold">Gold word on my lock screen</span>
          <span className="block text-sm text-muted-foreground">One word you already know that's due for review. Tap “Show meaning” — “I knew it!”</span>
        </label>
        <Switch
          id="phone-gold"
          checked={gold}
          onCheckedChange={(v) => {
            setGold(v);
            try { localStorage.setItem(KEY, JSON.stringify({ on, style, gold: v, subtitles })); } catch { /* ignore */ }
            toApp({ type: "gold", on: v });
            track(v ? "phone_gold_enabled" : "phone_gold_disabled");
          }}
        />
      </div>

      {/* 🦎 Home screen widget: red / orange / green counts + a hint of gold (DeckWidget.kt). */}
      <div className="flex items-center gap-3 border-t border-border pt-3">
        <span className="text-2xl" aria-hidden>🟥</span>
        <p className="flex-1">
          <span className="block font-semibold">Home screen widget</span>
          <span className="block text-sm text-muted-foreground">Your red, orange and green decks at a glance. Tap it to open your flashcards.</span>
        </p>
        <Button size="sm" variant="outline" onClick={() => { toApp({ type: "widget" }); track("phone_widget_requested"); }}>Add</Button>
      </div>
      {/* 🦎 Quick settings tile: swipe down → LinguaScript → the bubble (LinguaTileService.kt). */}
      <div className="flex items-center gap-3 border-t border-border pt-3">
        <span className="text-2xl" aria-hidden>⬇️</span>
        <p className="flex-1">
          <span className="block font-semibold">LinguaScript in quick settings</span>
          <span className="block text-sm text-muted-foreground">Swipe down from the top of your phone and tap LinguaScript to show the 🦎 bubble.</span>
        </p>
        <Button size="sm" variant="outline" onClick={() => { toApp({ type: "tile" }); track("phone_tile_requested"); }}>Add</Button>
      </div>
      <p className="text-xs text-muted-foreground border-t border-border pt-3">
        No Add box? Swipe down twice, tap ✏️ (edit) and drag the <b>LinguaScript</b> tile next to the torch. To hide the bubble, drag it onto the ✕ at the bottom.
        <br />Highlight a word in any app → <b>Save to LinguaScript</b>. On Samsung, tap <b>Manage apps</b> in that menu once and switch LinguaScript on.
      </p>
    </section>
  );
}
