/**
 * Analytics consent (UK GDPR + PECR): PostHog and Clarity only run after the
 * visitor taps "Accept". Essential storage (sign-in, settings) needs no consent.
 */
import posthog from "posthog-js";
import { initIntegrations } from "./integrations";

const KEY = "ls.consent.analytics";
export type Consent = "granted" | "denied" | null;

export function getConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch { return null; }
}

export function setConsent(v: "granted" | "denied") {
  try { localStorage.setItem(KEY, v); } catch { /* ignore */ }
  if (v === "granted") {
    posthog.set_config({ persistence: "localStorage+cookie" });
    posthog.opt_in_capturing();
    initIntegrations();
  } else {
    posthog.opt_out_capturing();
  }
  window.dispatchEvent(new Event("ls-consent"));
}

/** Re-open the banner (Cookies page "Change my choice"). */
export function resetConsent() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event("ls-consent"));
}
