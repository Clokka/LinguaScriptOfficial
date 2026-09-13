import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";

export interface ProStatus {
  isPro: boolean;
  source: "subscription" | "admin_grant" | "none";
  expiresAt: string | null;
  /** Stripe subscription state, when the user pays by card subscription. */
  status: string | null;
  cancelAtPeriodEnd: boolean;
  /** True when the user has a Stripe customer record we can open a portal for. */
  hasBillingAccount: boolean;
  /** A one-off/lifetime purchase or admin grant — nothing to renew. */
  isLifetime: boolean;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Single source of truth for Pro access. Card payments (Stripe) are the only
 * paid route on the web app; RevenueCat was removed because its placeholder
 * key meant it could report a conflicting entitlement that no payment backed.
 *
 * Pro is true when profiles.is_pro is set (written server-side by the payments
 * webhook, the subscription sync trigger, or an admin grant) AND the stored
 * expiry, if any, hasn't passed.
 */
export function useSubscription(): ProStatus {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileRow, setProfileRow] = useState<{
    is_pro: boolean;
    pro_source: string;
    pro_expires_at: string | null;
  } | null>(null);
  const [sub, setSub] = useState<{
    status: string;
    current_period_end: string | null;
    cancel_at_period_end: boolean | null;
    stripe_customer_id: string | null;
  } | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setProfileRow(null);
      setSub(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const env = isPaymentsConfigured() ? getStripeEnvironment() : "sandbox";

    const [{ data: prof }, { data: subRow }] = await Promise.all([
      supabase
        .from("profiles")
        .select("is_pro, pro_source, pro_expires_at")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("subscriptions")
        .select("status, current_period_end, cancel_at_period_end, stripe_customer_id")
        .eq("user_id", user.id)
        .eq("environment", env)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    setProfileRow((prof as any) ?? null);
    setSub((subRow as any) ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void refresh();
    if (!user) return;
    const channel = supabase
      .channel(`sub-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  const notExpired =
    !profileRow?.pro_expires_at || new Date(profileRow.pro_expires_at) > new Date();
  const isPro = !!profileRow?.is_pro && notExpired;

  const source: ProStatus["source"] = !isPro
    ? "none"
    : profileRow?.pro_source === "admin_grant"
      ? "admin_grant"
      : "subscription";

  return {
    isPro,
    source,
    expiresAt: profileRow?.pro_expires_at ?? sub?.current_period_end ?? null,
    status: sub?.status ?? null,
    cancelAtPeriodEnd: !!sub?.cancel_at_period_end,
    hasBillingAccount: !!sub?.stripe_customer_id,
    isLifetime: isPro && !profileRow?.pro_expires_at,
    loading,
    refresh,
  };
}
