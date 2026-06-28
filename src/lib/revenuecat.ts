import { Purchases, type CustomerInfo, type Offering, type Package } from "@revenuecat/purchases-js";

const API_KEY = "test_hBiiztbsqHCnkCKEwzsnXYVbwJB";
export const PRO_ENTITLEMENT_ID = "linguascript Pro";

let configuredUserId: string | null = null;

/**
 * Configure RevenueCat for the given user. Safe to call repeatedly — it only
 * re-configures when the user id actually changes.
 */
export function configureRevenueCat(userId: string | null) {
  // RC Web requires a non-anonymous user id. Use a stable anonymous id for
  // signed-out visitors so the Pricing page can still load Offerings.
  const appUserId = userId ?? Purchases.generateRevenueCatAnonymousAppUserId();
  if (configuredUserId === appUserId) return;

  try {
    Purchases.configure(API_KEY, appUserId);
    configuredUserId = appUserId;
  } catch (e) {
    // configure throws if already configured with a different user — fall back to changeUser.
    try {
      // @ts-ignore — changeUser exists on the singleton instance
      Purchases.getSharedInstance().changeUser(appUserId);
      configuredUserId = appUserId;
    } catch (err) {
      console.error("[RevenueCat] configure failed", err);
    }
  }
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
