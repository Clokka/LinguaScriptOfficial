// A/B test engine: sticky per-visitor variant assignment, privacy-safe
// segment capture, and one-time event recording through a validated RPC.
import { supabase } from "@/integrations/supabase/client";

const VISITOR_KEY = "ls.visitorId";
const ASSIGN_KEY = "ls.experiments.v1";
const ATTR_KEY = "ls.attribution.v1";

export function visitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

/** Deterministic hash so a visitor always lands in the same variant. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type Motivation = "anime" | "exam" | "travel" | "career" | "unknown";

/** Motivation guessed from the ad/link that brought them (utm or ?seg=). */
function motivationFrom(text: string): Motivation {
  const t = text.toLowerCase();
  if (/anime|manga|kdrama|drama/.test(t)) return "anime";
  if (/exam|alevel|a-level|gcse|school|student|study/.test(t)) return "exam";
  if (/travel|holiday|trip/.test(t)) return "travel";
  if (/career|work|business|job/.test(t)) return "career";
  return "unknown";
}

/** Captured once per visitor on first landing, then reused. */
export function captureAttribution(): Record<string, string> {
  try {
    const saved = localStorage.getItem(ATTR_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  const p = new URLSearchParams(window.location.search);
  const source = p.get("utm_source") || (document.referrer ? new URL(document.referrer).hostname : "direct");
  const campaign = p.get("utm_campaign") || "";
  const attr = {
    source: source.slice(0, 60),
    campaign: campaign.slice(0, 60),
    motivation: motivationFrom(`${p.get("seg") || ""} ${campaign} ${p.get("utm_content") || ""}`),
  };
  localStorage.setItem(ATTR_KEY, JSON.stringify(attr));
  return attr;
}

/** Location (timezone region only), language, device, and attribution. No precise location. */
export function segment(): Record<string, string> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown";
  return {
    ...captureAttribution(),
    region: tz.split("/")[0] || "unknown",
    timezone: tz,
    browser_language: (navigator.language || "unknown").slice(0, 2).toLowerCase(),
    device: window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop",
  };
}

function assignments(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(ASSIGN_KEY) || "{}"); } catch { return {}; }
}

/**
 * Sticky variant. A visitor whose motivation matches a variant name sees that
 * variant only when `matchMotivation` is set; otherwise assignment is random
 * (hash-based), which keeps the test fair.
 */
export function getVariant(key: string, variants: string[]): string {
  const a = assignments();
  if (a[key] && variants.includes(a[key])) return a[key];
  const v = variants[hash(`${key}:${visitorId()}`) % variants.length];
  a[key] = v;
  localStorage.setItem(ASSIGN_KEY, JSON.stringify(a));
  return v;
}

export type ExperimentEvent = "view" | "cta" | "signup" | "first_word" | "upgrade";

export async function track(key: string, event: ExperimentEvent, extra: Record<string, string> = {}) {
  const variant = assignments()[key];
  if (!variant) return; // never saw the test
  try {
    await (supabase as any).rpc("record_experiment_event", {
      _key: key,
      _visitor: visitorId(),
      _variant: variant,
      _event: event,
      _segment: { ...segment(), ...extra },
    });
  } catch { /* tracking must never break the app */ }
}

/** Record a conversion on every experiment this visitor is in. */
export function trackAll(event: ExperimentEvent, extra: Record<string, string> = {}) {
  Object.keys(assignments()).forEach((k) => void track(k, event, extra));
}

// ── Statistics: two-proportion z-test vs control ──
export const MIN_SAMPLE = 1000;

function normCdf(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

export function compare(cA: number, nA: number, cB: number, nB: number) {
  if (nA === 0 || nB === 0) return { lift: 0, confidence: 0 };
  const pA = cA / nA, pB = cB / nB;
  const p = (cA + cB) / (nA + nB);
  const se = Math.sqrt(p * (1 - p) * (1 / nA + 1 / nB));
  const z = se === 0 ? 0 : (pB - pA) / se;
  return { lift: pA === 0 ? 0 : (pB - pA) / pA, confidence: 1 - 2 * (1 - normCdf(Math.abs(z))) };
}
