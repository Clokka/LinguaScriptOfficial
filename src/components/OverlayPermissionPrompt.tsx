import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { track } from "@/lib/analytics";
import type { SiteToAppMessage } from "@linguascript/core/bridge";

/**
 * Asks Android-app learners to let LinguaScript appear over other apps, so the
 * 🦎 bubble can colour red/orange/green/gold words everywhere. "Allow" turns on
 * the same bubble as the Profile switch; the app then opens Android's
 * "appear on top" permission screen. "Not now" re-asks after 3 days, max 3 times.
 */
const BUBBLE_KEY = "ls.phoneBubble";
const PROMPT_KEY = "ls.overlayPrompt";
const RETRY_MS = 3 * 24 * 60 * 60 * 1000;

const toApp = (msg: SiteToAppMessage) => {
  try { (window as any).ReactNativeWebView?.postMessage(JSON.stringify(msg)); } catch { /* not in the app */ }
};

export function OverlayPermissionPrompt() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const inAndroidApp = !!(window as any).ReactNativeWebView && /Android/i.test(navigator.userAgent);
    if (!user || !inAndroidApp) return;
    if (/\/watch|\/video|\/player/.test(window.location.pathname)) return;
    try {
      const bubble = JSON.parse(localStorage.getItem(BUBBLE_KEY) || "{}");
      if (bubble.on) return;
      const p = JSON.parse(localStorage.getItem(PROMPT_KEY) || "{}");
      if ((p.count ?? 0) >= 3 || Date.now() - (p.last ?? 0) < RETRY_MS) return;
    } catch { /* ignore */ }
    const t = setTimeout(() => { setOpen(true); track("overlay_prompt_shown"); }, 2500);
    return () => clearTimeout(t);
  }, [user]);

  const remember = () => {
    try {
      const p = JSON.parse(localStorage.getItem(PROMPT_KEY) || "{}");
      localStorage.setItem(PROMPT_KEY, JSON.stringify({ count: (p.count ?? 0) + 1, last: Date.now() }));
    } catch { /* ignore */ }
  };

  const allow = () => {
    let style: "text" | "ring" = "ring";
    try { if (JSON.parse(localStorage.getItem(BUBBLE_KEY) || "{}").style === "text") style = "text"; } catch { /* ignore */ }
    try { localStorage.setItem(BUBBLE_KEY, JSON.stringify({ on: true, style })); } catch { /* ignore */ }
    remember();
    toApp({ type: "bubble", on: true, style });
    track("overlay_prompt_allowed");
    setOpen(false);
  };

  const later = () => { remember(); track("overlay_prompt_dismissed"); setOpen(false); };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) later(); }}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="text-4xl text-center" aria-hidden>🦎</div>
          <DialogTitle className="text-center">Colour your words in other apps?</DialogTitle>
          <DialogDescription className="text-center">
            Allow LinguaScript to appear over the top of other apps. Tap the chameleon bubble and your words light up in red, orange, green and gold — anywhere on your phone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-3 py-2" aria-hidden>
          {["#FF3B30", "#FF8A00", "#34C759", "#FFD54A"].map((c) => (
            <span key={c} className="block w-7 h-7 rounded-full border-[3px]" style={{ borderColor: c }} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={allow} className="h-11">Allow</Button>
          <Button variant="ghost" onClick={later}>Not now</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
