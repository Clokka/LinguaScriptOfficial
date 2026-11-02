import { Suspense, lazy, useEffect, useState } from "react";
import Landing5 from "@/pages/Landing5";
import LandingClear from "@/pages/LandingClear";
import { PageLoading } from "@/components/PageLoading";
import { getVariant, track } from "@/lib/experiments";

const LabLanding = lazy(() => import("@/pages/landing/LabLanding"));

/**
 * Whole-page A/B test on the homepage (round 2, Design Lab pages).
 *
 *   current → Landing5 (the Chameleon Method page) — control
 *   gold    → LabLanding theme "gold"  (black & gold, kinetic morphing word)
 *   glass   → LabLanding theme "glass" (Liquid-Glass film frame)
 *   split   → LabLanding theme "split" (black/white split)
 *
 * Four arms only: with our traffic, more arms would never reach significance.
 * Each visitor stays in one version. Preview without joining the test:
 * /?lp=current | gold | glass | split | clear (the round-1 page).
 */
export const LANDING_TEST_KEY = "landing_page_v2";
const VARIANTS = ["current", "gold", "glass", "split"];
const PREVIEWS = [...VARIANTS, "clear"];

export const LandingPageTest = () => {
  const [preview] = useState(() => {
    const lp = new URLSearchParams(window.location.search).get("lp");
    return lp && PREVIEWS.includes(lp) ? lp : null;
  });
  const [variant] = useState(() => preview ?? getVariant(LANDING_TEST_KEY, VARIANTS));

  useEffect(() => {
    if (!preview) void track(LANDING_TEST_KEY, "view");
  }, [preview]);

  if (variant === "clear") return <LandingClear />;
  if (variant === "gold" || variant === "glass" || variant === "split") {
    return (
      <Suspense fallback={<PageLoading />}>
        <LabLanding theme={variant} />
      </Suspense>
    );
  }
  return <Landing5 />;
};

export default LandingPageTest;
