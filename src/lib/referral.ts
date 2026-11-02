/**
 * Partner programme: remember which partner sent this visitor, then credit
 * the account once at sign-up (claim_referral, new accounts only).
 *
 * Keeping the code for 30 days is a tracking cookie under PECR, so it waits
 * for analytics consent. Without consent it lives only for this visit
 * (sessionStorage): a same-visit sign-up still counts.
 */
import { supabase } from "@/integrations/supabase/client";
import { getConsent } from "@/lib/consent";

const KEY = "ls.ref";
const DAYS = 30;
type Ref = { code: string; channel: string; at: number };

const valid = (c: string) => /^[a-z0-9][a-z0-9_-]{1,30}$/.test(c);

export function saveRef(code: string, channel = "other") {
  const c = code.trim().toLowerCase();
  if (!valid(c)) return;
  const v = JSON.stringify({ code: c, channel: channel.toLowerCase().slice(0, 20) || "other", at: Date.now() } satisfies Ref);
  try {
    if (getConsent() === "granted") localStorage.setItem(KEY, v);
    else sessionStorage.setItem(KEY, v);
  } catch { /* private mode */ }
}

export function getRef(): Ref | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(KEY);
      if (!raw) continue;
      const r = JSON.parse(raw) as Ref;
      if (Date.now() - r.at < DAYS * 864e5 && valid(r.code)) return r;
      store.removeItem(KEY);
    } catch { /* ignore */ }
  }
  return null;
}

export function clearRef() {
  try { sessionStorage.removeItem(KEY); localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** ?ref=code on any page (links shared without /r/). */
export function captureRefFromUrl() {
  try {
    const p = new URLSearchParams(window.location.search);
    const ref = p.get("ref");
    if (ref) saveRef(ref, p.get("utm_source") || p.get("ch") || "other");
  } catch { /* ignore */ }
}

/** After sign-in: credit a brand-new account to the partner, once. */
export async function claimRefIfAny() {
  const r = getRef();
  if (!r) return;
  try {
    await (supabase as any).rpc("claim_referral", { _code: r.code, _channel: r.channel });
  } catch { /* try again next sign-in */ return; }
  clearRef();
}
