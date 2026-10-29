import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";

/**
 * "🦎 Colour words on my phone" — the Android bubble (mobile/plugins/withWordBubble.js).
 * Shown only inside the Android app. The app turns the bubble on/off; the
 * website only remembers the choice for this switch.
 */
const KEY = "ls.phoneBubble";
const toApp = (msg: unknown) => {
  try { (window as any).ReactNativeWebView?.postMessage(JSON.stringify(msg)); } catch { /* not in the app */ }
};

export function PhoneBubbleSetting() {
  const inAndroidApp = typeof window !== "undefined" && !!(window as any).ReactNativeWebView && /Android/i.test(navigator.userAgent);
  const [on, setOn] = useState(false);
  const [style, setStyle] = useState<"text" | "ring">("text");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      setOn(!!saved.on);
      if (saved.style === "ring") setStyle("ring");
    } catch { /* ignore */ }
  }, []);

  if (!inAndroidApp) return null;

  const save = (next: { on: boolean; style: "text" | "ring" }) => {
    setOn(next.on);
    setStyle(next.style);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
    toApp({ type: "bubble", on: next.on, style: next.style });
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>🦎</span>
        <label htmlFor="phone-bubble" className="flex-1 font-semibold">Colour words on my phone</label>
        <Switch
          id="phone-bubble"
          checked={on}
          onCheckedChange={(v) => { save({ on: v, style }); track(v ? "phone_colour_enabled" : "phone_colour_disabled", { style }); }}
        />
      </div>
      {on && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Word style">
          {(["text", "ring"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={style === s}
              onClick={() => { save({ on, style: s }); track("phone_colour_style", { style: s }); }}
              className={`h-11 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 ${style === s ? "border-primary bg-primary/10" : "border-border"}`}
            >
              {s === "text" ? (
                <span><b style={{ color: "#FF3B30" }}>A</b><b style={{ color: "#FF8A00" }}>a</b><b style={{ color: "#34C759" }}>a</b><b style={{ color: "#FFD54A" }}>a</b></span>
              ) : (
                <span className="flex gap-0.5">{["#FF3B30", "#FF8A00", "#34C759", "#FFD54A"].map((c) => <i key={c} className="block w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: c }} />)}</span>
              )}
              {s === "text" ? "Colour" : "Rings"}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
