import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getStripeEnvironment, isPaymentsConfigured } from "@/lib/stripe";

export interface SubscriptionRow {
  id: string;
  status: string;
  price_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  stripe_customer_id: string;
}

export interface ProStatus {
  isPro: boolean;
  source: "subscription" | "admin_grant" | "none";
  expiresAt: string | null;
  subscription: SubscriptionRow | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function useSubscription(): ProStatus {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileRow, setProfileRow] = useState<{ is_pro: boolean; pro_source: string; pro_expires_at: string | null } | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionRow | null>(null);

  const refresh = async () => {
    if (!user) {
      setProfileRow(null);
      setSubscription(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const profileQ = supabase
      .from("profiles")
      .select("is_pro, pro_source, pro_expires_at")
      .eq("user_id", user.id)
      .maybeSingle();

    const env = isPaymentsConfigured() ? getStripeEnvironment() : "sandbox";
    const subQ = supabase
      .from("subscriptions")
      .select("id, status, price_id, current_period_end, cancel_at_period_end, stripe_customer_id")
      .eq("user_id", user.id)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const [{ data: prof }, { data: sub }] = await Promise.all([profileQ, subQ]);
    setProfileRow((prof as any) ?? null);
    setSubscription((sub as any) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    if (!user) return;
    const channel = supabase
      .channel(`sub-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` }, () => void refresh())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const subActive = !!subscription
    && ACTIVE_STATUSES.has(subscription.status)
    && (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date());
  const profileActive = !!profileRow?.is_pro
    && (!profileRow.pro_expires_at || new Date(profileRow.pro_expires_at) > new Date());

  const isPro = subActive || profileActive;
  const source = (profileRow?.pro_source as ProStatus["source"]) || (subActive ? "subscription" : "none");

  return {
    isPro,
    source,
    expiresAt: profileRow?.pro_expires_at ?? subscription?.current_period_end ?? null,
    subscription,
    loading,
    refresh,
  };
}
