import { Purchases, type CustomerInfo, type Offering, type Package } from "@revenuecat/purchases-js";

const API_KEY = "test_hBiiztbsqHCnkCKEwzsnXYVbwJB";
export const PRO_ENTITLEMENT_ID = "linguascript Pro";

let configuredUserId: string | null = null;

/**
 * Configure RevenueCat for the given user. Safe to call repeatedly — it only
 * re-configures when the user id actually changes.
 */
export function configureRevenueCat(userId: string | null) {
  const appUserId = userId ?? Purchases.generateRevenueCatAnonymousAppUserId();
  if (configuredUserId === appUserId) return;

  if (!Purchases.isConfigured()) {
    Purchases.configure(API_KEY, appUserId);
  } else {
    void Purchases.getSharedInstance().changeUser(appUserId).catch((e) => {
      console.error("[RevenueCat] changeUser failed", e);
    });
  }
  configuredUserId = appUserId;
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    return await Purchases.getSharedInstance().getCustomerInfo();
  } catch (e) {
    console.error("[RevenueCat] getCustomerInfo failed", e);
    return null;
  }
}

export function hasProEntitlement(info: CustomerInfo | null | undefined): boolean {
  if (!info) return false;
  const ent = info.entitlements.active[PRO_ENTITLEMENT_ID];
  return !!ent;
}

export async function getCurrentOffering(): Promise<Offering | null> {
  try {
    const offerings = await Purchases.getSharedInstance().getOfferings();
    return offerings.current ?? null;
  } catch (e) {
    console.error("[RevenueCat] getOfferings failed", e);
    return null;
  }
}

export async function purchasePackage(pkg: Package): Promise<CustomerInfo> {
  const result = await Purchases.getSharedInstance().purchase({ rcPackage: pkg });
  return result.customerInfo;
}

export { Purchases };
export type { CustomerInfo, Offering, Package };
