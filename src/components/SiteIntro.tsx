// The app-opening loading screen: plays once when LinguaScript opens (website
// or phone app), on any page. Lazy: the loader code is only fetched when it plays.
import { lazy, Suspense, useState } from "react";
import { useLocation } from "react-router-dom";
import { introToPlay, markIntroSeen } from "@/lib/site/intro";

const IntroLoader = lazy(() => import("@/components/landing/IntroLoader"));
// Pages where an intro would only get in the way.
const SKIP = /^\/(hq|partners|r\/|reset-password|\.lovable|unsubscribe|overlay|brand)/;

export function SiteIntro() {
  const { pathname } = useLocation();
  const [plan] = useState(() => (SKIP.test(window.location.pathname) ? null : introToPlay()));
  const [done, setDone] = useState(false);
  if (!plan || done || SKIP.test(pathname)) return null;
  return (
    <Suspense fallback={null}>
      <IntroLoader loader={plan.intro.loader} end={plan.intro.end} onDone={() => { if (!plan.preview) markIntroSeen(); setDone(true); }} />
    </Suspense>
  );
}
