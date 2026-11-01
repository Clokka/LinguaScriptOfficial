/**
 * Product analytics — one place for every PostHog event.
 *
 * THE FUNNEL (build this in PostHog → Product analytics → Funnel, in order):
 *   1. $pageview (landing)          — automatic
 *   2. cta_clicked                   — landing "Start" buttons
 *   3. signed_up                     — account created (email or Google)
 *   4. onboarding_completed          — language, hobby, goal chosen
 *   5. video_started                 — first value: a video opens
 *   6. word_saved   (first_word_saved once)  — the "aha" moment
 *   7. flashcard_reviewed / word_turned_green — the learning loop
 *   8. paywall_viewed → checkout_started → upgrade_completed — revenue
 *
 * Every event automatically carries the visitor's first-touch source
 * (utm_source / referrer), campaign and motivation (anime / exam / travel …),
 * so any funnel can be broken down by "which ad brought them".
 *
 * Event names are snake_case, past tense. Never put emails or free text in
 * properties. Tracking must never break the app, so everything is try/catch.
 */
import { posthogStarted, withPosthog } from "@/lib/posthog";
import { captureAttribution, segment } from "@/lib/experiments";

export type AnalyticsEvent =
  | "cta_clicked"
  | "signup_started"
  | "signed_up"
  | "onboarding_step_completed"
  | "onboarding_completed"
  | "video_started"
  | "video_completed"
  | "word_saved"
  | "first_word_saved"
  | "flashcard_reviewed"
  | "word_turned_green"
  | "gold_word_tapped"
  | "daily_goal_reached"
  | "paywall_viewed"
  | "checkout_started"
  | "upgrade_completed"
  | "extension_connected"
  | "extension_install_clicked"
  | "write_checked"
  | "speak_finished"
  | "studio_video_made"
  | "mcp_connect_clicked"
  | "phone_gold_enabled"
  | "phone_gold_disabled"
  | "phone_widget_requested"
  | "phone_subtitles_enabled"
  | "phone_subtitles_disabled"
  | "phone_colour_enabled"
  | "phone_colour_disabled"
  | "phone_colour_style"
  | "overlay_prompt_shown"
  | "overlay_prompt_allowed"
  | "overlay_prompt_dismissed"
  | "page_scan_started"
  | "page_scanned";

type Props = Record<string, string | number | boolean | null | undefined>;

let registered = false;

/** Attach first-touch attribution to every event (call once at startup). */
export function initAnalytics() {
  if (registered || !posthogStarted()) return;
  registered = true;
  try {
    const attr = captureAttribution(); // first touch, saved per visitor
    const seg = segment();
    withPosthog((posthog) => posthog.register_once({
      first_source: attr.source,
      first_campaign: attr.campaign,
      first_motivation: attr.motivation,
    }));
    withPosthog((posthog) => posthog.register({ device: seg.device, browser_language: seg.browser_language, region: seg.region }));
  } catch { /* never break the app */ }
}

/** Type localStorage.setItem("ls.debugAnalytics","1") in the console to see every event. */
const debug = () => { try { return localStorage.getItem("ls.debugAnalytics") === "1"; } catch { return false; } };

export function track(event: AnalyticsEvent, props: Props = {}) {
  try {
    if (debug()) console.info("[analytics]", event, props);
    withPosthog((posthog) => posthog.capture(event, props));
  } catch { /* never break the app */ }
}

/** Fire an event only the first time on this device (e.g. first_word_saved). */
export function trackOnce(event: AnalyticsEvent, props: Props = {}) {
  const key = `ls.once.${event}`;
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, new Date().toISOString());
  } catch { /* private mode: fall through and track anyway */ }
  track(event, props);
}

/** Person properties shown on the user's PostHog profile (for cohorts). */
export function setPerson(props: Props) {
  try {
    withPosthog((posthog) => posthog.setPersonProperties(props));
  } catch { /* never break the app */ }
}
