// Real, shared Stripe plan config for /pricing — backed by the
// payment_plans table (see migration 20260913070000_payment_plans.sql).
//
// This used to live in the admin's own localStorage, which meant only the
// admin's own browser ever saw configured plans; every other visitor's
// /pricing page rendered "no plans available" because their browser never
// had that localStorage key. A real table makes prices an admin configures
// visible to every visitor, which is the entire point of a paywall.
import { supabase } from "@/integrations/supabase/client";

export type StripePlanKey = "monthly" | "yearly" | "lifetime";

export interface StripeFallbackPlan {
  priceId: string;
  label: string;
  priceDisplay: string; // e.g. "$9.99 / month"
  enabled: boolean;
}

export type StripeFallbackConfig = Record<StripePlanKey, StripeFallbackPlan>;

const PLAN_KEYS: StripePlanKey[] = ["monthly", "yearly", "lifetime"];

const DEFAULT_CONFIG: StripeFallbackConfig = {
  monthly: { priceId: "", label: "Monthly", priceDisplay: "$9.99 / month", enabled: false },
  yearly: { priceId: "", label: "Yearly", priceDisplay: "$79.99 / year", enabled: false },
  lifetime: { priceId: "", label: "Lifetime", priceDisplay: "$199 one-time", enabled: false },
};

export async function getStripeFallbackConfig(): Promise<StripeFallbackConfig> {
  const { data, error } = await supabase
    .from("payment_plans" as any)
    .select("plan_key, label, price_display, price_id, enabled")
    .order("sort_order");
  if (error || !data) return DEFAULT_CONFIG;
  const cfg: StripeFallbackConfig = { ...DEFAULT_CONFIG };
  for (const row of data as any[]) {
    const key = row.plan_key as StripePlanKey;
    if (!PLAN_KEYS.includes(key)) continue;
    cfg[key] = {
      priceId: row.price_id ?? "",
      label: row.label ?? DEFAULT_CONFIG[key].label,
      priceDisplay: row.price_display ?? DEFAULT_CONFIG[key].priceDisplay,
      enabled: !!row.enabled,
    };
  }
  return cfg;
}

export async function saveStripeFallbackConfig(cfg: StripeFallbackConfig): Promise<{ error?: string }> {
  const rows = PLAN_KEYS.map((key, i) => ({
    plan_key: key,
    label: cfg[key].label,
    price_display: cfg[key].priceDisplay,
    price_id: cfg[key].priceId,
    enabled: cfg[key].enabled,
    sort_order: i + 1,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await (supabase as any)
    .from("payment_plans")
    .upsert(rows, { onConflict: "plan_key" });
  return { error: error?.message };
}

export async function getEnabledFallbackPlans(): Promise<Array<{ key: StripePlanKey } & StripeFallbackPlan>> {
  const cfg = await getStripeFallbackConfig();
  return PLAN_KEYS
    .map((key) => ({ key, ...cfg[key] }))
    .filter((p) => p.enabled && p.priceId.trim().length > 0);
}
