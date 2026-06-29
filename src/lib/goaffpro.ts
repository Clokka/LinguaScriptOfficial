// GoAffPro conversion tracking helper.
// Fires the affiliate conversion event after a successful Pro purchase.
// The loader script in index.html exposes a global `goaffproOrder` object
// which must be set before triggering the conversion.

declare global {
  interface Window {
    goaffproOrder?: { number: string | number; total: number; currency?: string };
    goaffpro_order?: (order: { number: string | number; total: number; currency?: string }) => void;
  }
}

export interface GoAffProOrder {
  number: string | number;
  total: number;
  currency?: string;
}

export function trackGoAffProConversion(order: GoAffProOrder) {
  if (typeof window === "undefined" || !order?.number || !order?.total) return;
  try {
    window.goaffproOrder = order;
    if (typeof window.goaffpro_order === "function") {
      window.goaffpro_order(order);
    }
  } catch (e) {
    console.error("[GoAffPro] conversion track failed", e);
  }
}
