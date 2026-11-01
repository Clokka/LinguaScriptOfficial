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
    <div role="dialog" aria-label="Cookie choices" className="fixed inset-x-3 bottom-3 z-[1000] mx-auto max-w-lg rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
      <p className="text-sm text-foreground">
        We use essential storage to keep you signed in. With your OK we also use analytics (PostHog, Microsoft Clarity) to see how LinguaScript is used and improve it.{" "}
        <Link to="/cookies" className="underline">Cookie notice</Link>
      </p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={() => setConsent("denied")}>Reject</Button>
        <Button size="sm" className="flex-1" onClick={() => setConsent("granted")}>Accept</Button>
      </div>
    </div>
  );
}
