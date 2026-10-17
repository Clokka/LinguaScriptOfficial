import { useEffect, useState } from "react";
import Landing from "@/pages/Landing";
import LandingEarlyAccess from "@/pages/LandingEarlyAccess";
import { getVariant, track } from "@/lib/experiments";

/**
 * Whole-page A/B test on the homepage.
 *
 *   loop  → Landing (/landing-7, play the real app loop, "Try LinguaScript free")
 *   early → LandingEarlyAccess (/landing-6, one email field, "Get early access")
 *
 * Each visitor is put in one version and stays there on every visit.
 * Preview either page without joining the test: /?lp=loop or /?lp=early
 * (v1, `landing_page`: Landing5 vs LandingClear, is paused; its results stay in Admin.)
 */
export const LANDING_TEST_KEY = "landing_page_v2";
const VARIANTS = ["loop", "early"];

export const LandingPageTest = () => {
  const [preview] = useState(() => {
    const lp = new URLSearchParams(window.location.search).get("lp");
    return lp && VARIANTS.includes(lp) ? lp : null;
  });
  const [variant] = useState(() => preview ?? getVariant(LANDING_TEST_KEY, VARIANTS));

  useEffect(() => {
    if (!preview) void track(LANDING_TEST_KEY, "view");
  }, [preview]);

  return variant === "early" ? <LandingEarlyAccess /> : <Landing />;
};

export default LandingPageTest;
