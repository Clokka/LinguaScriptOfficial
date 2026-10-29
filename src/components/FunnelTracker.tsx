import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { track } from "@/lib/analytics";

/** Pages inside the app — anything else (landing, blog, SEO pages) is marketing. */
const APP_PAGES = /^\/(discover|watch|flashcards|vocabulary|profile|progress|friends|write|speak|admin|teacher|onboarding|auth|checkout|upgrade|pricing)/;

/**
 * cta_clicked, everywhere at once: whenever a visitor goes from a marketing
 * page to sign-up or onboarding, that's a CTA click — whichever button it was.
 * `from` says which page converted them, so landing pages can be compared.
 */
export function FunnelTracker() {
  const { pathname } = useLocation();
  const prev = useRef<string | null>(null);
  useEffect(() => {
    const from = prev.current;
    prev.current = pathname;
    if (from === null || from === pathname) return;
    const toSignup = /^\/(onboarding|auth|pricing)/.test(pathname);
    if (toSignup && !APP_PAGES.test(from)) track("cta_clicked", { from, to: pathname });
  }, [pathname]);
  return null;
}
