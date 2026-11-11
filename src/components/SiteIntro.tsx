// The app-opening loading screen: plays once when LinguaScript opens (website
// or phone app), on any page. Lazy: the loader code is only fetched when it plays.
import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { introToPlay, markIntroSeen, setIntroPlaying } from "@/lib/site/intro";

const IntroLoader = lazy(() => import("@/components/landing/IntroLoader"));
// Pages where an intro would only get in the way.
const SKIP = /^\/(hq|partners|teacher|for-schools|schools|r\/|reset-password|\.lovable|unsubscribe|overlay|brand)/;

export function SiteIntro() {
  const { pathname } = useLocation();
  const [plan] = useState(() => {
    const p = SKIP.test(window.location.pathname) ? null : introToPlay();
    // Set before the first paint so the "Welcome back" pop-up waits for the intro.
    if (p) setIntroPlaying(true);
    return p;
  });
  const [done, setDone] = useState(false);
  const showing = !!plan && !done && !SKIP.test(pathname);
  useEffect(() => {
    setIntroPlaying(showing);
    return () => setIntroPlaying(false);
  }, [showing]);
  if (!showing) return null;
  return (
    <Suspense fallback={null}>
      <IntroLoader loader={plan.intro.loader} end={plan.intro.end} onDone={() => { if (!plan.preview) markIntroSeen(); setDone(true); }} />
    </Suspense>
  );
}
