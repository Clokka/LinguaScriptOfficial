import { useEffect, useState } from "react";
import Landing5 from "@/pages/Landing5";
import LandingClear from "@/pages/LandingClear";
import { getVariant, track } from "@/lib/experiments";

/**
 * Whole-page A/B test on the homepage.
 *
 *   current → Landing5 (the Chameleon Method page)
 *   clear   → LandingClear (benefit-first page with one big button)
 *
 * Each visitor is put in one version and stays there on every visit.
 * Preview either page without joining the test: /?lp=current or /?lp=clear
 */
export const LANDING_TEST_KEY = "landing_page";
const VARIANTS = ["current", "clear"];

export const LandingPageTest = () => {
  const [preview] = useState(() => {
    const lp = new URLSearchParams(window.location.search).get("lp");
    return lp && VARIANTS.includes(lp) ? lp : null;
  });
  const [variant] = useState(() => preview ?? getVariant(LANDING_TEST_KEY, VARIANTS));

  useEffect(() => {
    if (!preview) void track(LANDING_TEST_KEY, "view");
  }, [preview]);

  return variant === "clear" ? <LandingClear /> : <Landing5 />;
};

export default LandingPageTest;
