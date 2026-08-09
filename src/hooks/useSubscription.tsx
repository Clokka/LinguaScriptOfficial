import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  configureRevenueCat,
  getCustomerInfo,
  hasProEntitlement,
  type CustomerInfo,
} from "@/lib/revenuecat";

export interface ProStatus {
  isPro: boolean;
  source: "subscription" | "admin_grant" | "none";
  expiresAt: string | null;
  customerInfo: CustomerInfo | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Pro status is the union of:
 *   1. RevenueCat "linguascript Pro" entitlement (paid users)
 *   2. profiles.is_pro with pro_source='admin_grant' (admin-granted)
 */
export function useSubscription(): ProStatus {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profileRow, setProfileRow] = useState<{ is_pro: boolean; pro_source: string; pro_expires_at: string | null } | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      configureRevenueCat(user?.id ?? null);

      const profilePromise = user
        ? supabase
            .from("profiles")
            .select("is_pro, pro_source, pro_expires_at")
            .eq("user_id", user.id)
            .maybeSingle()
        : Promise.resolve({ data: null } as any);

      const [{ data: prof }, info] = await Promise.all([profilePromise, getCustomerInfo()]);
      setProfileRow((prof as any) ?? null);
      setCustomerInfo(info);
    } catch {
      // Non-fatal: leave existing state, just clear the spinner.
    } finally {
      setLoading(false);
    }
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, refresh]);

  const rcPro = hasProEntitlement(customerInfo);
  const rcExpires = customerInfo?.entitlements.active["linguascript Pro"]?.expirationDate ?? null;
  const adminPro = !!profileRow?.is_pro
    && profileRow.pro_source === "admin_grant"
    && (!profileRow.pro_expires_at || new Date(profileRow.pro_expires_at) > new Date());

  const isPro = rcPro || adminPro;
  const source: ProStatus["source"] = adminPro ? "admin_grant" : rcPro ? "subscription" : "none";
  const expiresAt = adminPro
    ? profileRow?.pro_expires_at ?? null
    : rcExpires
      ? (rcExpires instanceof Date ? rcExpires.toISOString() : String(rcExpires))
      : null;

  return { isPro, source, expiresAt, customerInfo, loading, refresh };
}
