import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getConsent, setConsent } from "@/lib/consent";

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const sync = () => setOpen(getConsent() === null);
    sync();
    window.addEventListener("ls-consent", sync);
    return () => window.removeEventListener("ls-consent", sync);
  }, []);
  if (open === false) return null;
  // Not over the phone app's welcome screen (its buttons sit at the bottom);
  // it shows on the next page. Analytics stay off until Accept either way.
  if (pathname === "/" && (window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView) return null;
  return (
    <div role="dialog" aria-label="Cookie choices" className="fixed inset-x-3 bottom-3 z-[1000] mx-auto max-w-lg rounded-2xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur flex items-center gap-3">
      {/* Short on purpose: the long version covered onboarding's Next button on phones. */}
      <p className="text-xs text-foreground flex-1">
        OK to use analytics cookies (PostHog, Clarity)?{" "}
        <Link to="/cookies" className="underline">Details</Link>
      </p>
      <Button size="sm" variant="outline" onClick={() => setConsent("denied")}>No</Button>
      <Button size="sm" onClick={() => setConsent("granted")}>OK</Button>
    </div>
  );
}
