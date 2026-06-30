// Stripe fallback plan configuration.
// Stored in localStorage so admins can set/update Stripe price IDs without a deploy,
// and used by /pricing as a backup when RevenueCat is unavailable.

export type StripePlanKey = "monthly" | "yearly" | "lifetime";

export interface StripeFallbackPlan {
  priceId: string;
  label: string;
  priceDisplay: string; // e.g. "$9.99 / month"
  enabled: boolean;
}

export type StripeFallbackConfig = Record<StripePlanKey, StripeFallbackPlan>;

const STORAGE_KEY = "linguascript.stripeFallback.v1";

const DEFAULT_CONFIG: StripeFallbackConfig = {
  monthly: { priceId: "", label: "Monthly", priceDisplay: "$9.99 / month", enabled: false },
  yearly: { priceId: "", label: "Yearly", priceDisplay: "$79.99 / year", enabled: false },
  lifetime: { priceId: "", label: "Lifetime", priceDisplay: "$199 one-time", enabled: false },
};

export function getStripeFallbackConfig(): StripeFallbackConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<StripeFallbackConfig>;
    return {
      monthly: { ...DEFAULT_CONFIG.monthly, ...(parsed.monthly ?? {}) },
      yearly: { ...DEFAULT_CONFIG.yearly, ...(parsed.yearly ?? {}) },
      lifetime: { ...DEFAULT_CONFIG.lifetime, ...(parsed.lifetime ?? {}) },
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveStripeFallbackConfig(cfg: StripeFallbackConfig): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

export function getEnabledFallbackPlans(): Array<{ key: StripePlanKey } & StripeFallbackPlan> {
  const cfg = getStripeFallbackConfig();
  return (Object.keys(cfg) as StripePlanKey[])
    .map((key) => ({ key, ...cfg[key] }))
    .filter((p) => p.enabled && p.priceId.trim().length > 0);
}
