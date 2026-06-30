import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, ArrowLeft, Loader2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { getCurrentOffering, purchasePackage, configureRevenueCat, type Package } from "@/lib/revenuecat";
import { trackGoAffProConversion } from "@/lib/goaffpro";
import { getEnabledFallbackPlans } from "@/lib/stripeFallback";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";
import { toast } from "@/hooks/use-toast";

const FEATURES = [
  "Unlimited learning languages — switch freely between French, Spanish, German, Italian and more",
  "Priority AI translations & faster word lookups",
  "Unlimited flashcards and spaced-repetition reviews",
  "Early access to every new feature we ship",
  "Support an indie team building for language learners",
];

const PACKAGE_LABELS: Record<string, { label: string; note?: string; badge?: string }> = {
  $rc_monthly: { label: "Monthly", note: "Cancel anytime" },
  $rc_annual: { label: "Yearly", note: "Save with annual billing", badge: "Best value" },
  $rc_lifetime: { label: "Lifetime", note: "One-time payment, yours forever", badge: "Lifetime access" },
  monthly: { label: "Monthly", note: "Cancel anytime" },
  yearly: { label: "Yearly", note: "Save with annual billing", badge: "Best value" },
  lifetime: { label: "Lifetime", note: "One-time payment, yours forever", badge: "Lifetime access" },
};

function formatPrice(pkg: Package): string {
  const price = pkg.rcBillingProduct?.currentPrice;
  if (price?.formattedPrice) return price.formattedPrice;
  return "—";
}

function suffix(pkg: Package): string {
  const period = pkg.rcBillingProduct?.normalPeriodDuration;
  if (!period) return "";
  if (period === "P1M") return "/ month";
  if (period === "P1Y") return "/ year";
  if (period === "P1W") return "/ week";
  return "";
}

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, source, loading: subLoading, expiresAt, refresh } = useSubscription();
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [rcFailed, setRcFailed] = useState(false);
  const [stripePriceId, setStripePriceId] = useState<string | null>(null);
  const fallbackPlans = useMemo(() => getEnabledFallbackPlans(), []);
  const stripeAvailable = isPaymentsConfigured();
  const showFallback = fallbackPlans.length > 0 && stripeAvailable && (rcFailed || packages.length === 0 || !loadingOfferings);

  useEffect(() => {
    configureRevenueCat(user?.id ?? null);
    let cancelled = false;
    (async () => {
      setLoadingOfferings(true);
      const offering = await getCurrentOffering();
      if (cancelled) return;
      setPackages(offering?.availablePackages ?? []);
      setLoadingOfferings(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handlePurchase = async (pkg: Package) => {
    if (!user) {
      navigate("/auth?next=/pricing");
      return;
    }
    setPurchasing(pkg.identifier);
    try {
      const info = await purchasePackage(pkg);
      // Fire GoAffPro conversion using the latest transaction as the order reference.
      const txns = (info as any)?.nonSubscriptionTransactions ?? [];
      const latestTxn = txns[txns.length - 1];
      const orderNumber =
        latestTxn?.transactionIdentifier ||
        (info as any)?.originalAppUserId ||
        `${user.id}-${pkg.identifier}-${Date.now()}`;
      const price = pkg.rcBillingProduct?.currentPrice;
      trackGoAffProConversion({
        number: orderNumber,
        total: Number(price?.amountMicros ? price.amountMicros / 1_000_000 : 0),
        currency: price?.currency,
      });
      await refresh();
      toast({ title: "Welcome to Pro 🎉", description: "All languages unlocked." });
      navigate("/browse");
    } catch (e: any) {
      if (e?.errorCode !== 1) {
        // 1 = user cancelled
        toast({ title: "Purchase failed", description: e?.message ?? "Please try again.", variant: "destructive" });
      }
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
            <Sparkles className="w-3 h-3" /> LinguaScript Pro
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-3">
            Learn every language you want.
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Unlock the whole library and switch between languages freely without losing your streak.
          </p>
        </div>

        {!subLoading && isPro && (
          <div className="glass-panel-strong p-6 rounded-2xl mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h2 className="font-semibold text-foreground">You're on Pro</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                {source === "admin_grant"
                  ? `Granted by the LinguaScript team${expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : " · lifetime"}`
                  : expiresAt
                    ? `Renews ${new Date(expiresAt).toLocaleDateString()}`
                    : "Active subscription"}
              </p>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {loadingOfferings ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : packages.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12 text-sm">
              No plans are available right now. Please check back soon.
            </div>
          ) : (
            packages.map((pkg) => {
              const meta = PACKAGE_LABELS[pkg.identifier] ?? { label: pkg.identifier };
              const isLoading = purchasing === pkg.identifier;
              return (
                <button
                  key={pkg.identifier}
                  onClick={() => handlePurchase(pkg)}
                  disabled={!!purchasing || (isPro && source === "subscription")}
                  className="relative text-left glass-panel-strong p-6 rounded-2xl border border-border hover:border-primary/40 transition disabled:opacity-60"
                >
                  {meta.badge && (
                    <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                      {meta.badge}
                    </span>
                  )}
                  <div className="text-sm text-muted-foreground mb-2">{meta.label}</div>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="text-3xl font-bold text-foreground">{formatPrice(pkg)}</span>
                    <span className="text-sm text-muted-foreground">{suffix(pkg)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-4">{meta.note}</div>
                  <div className="text-sm font-medium text-primary inline-flex items-center gap-2">
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {isLoading ? "Opening checkout…" : isPro ? "Already Pro" : "Get Pro"}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="glass-panel p-6 rounded-2xl mb-8">
          <h3 className="font-semibold text-foreground mb-4">Everything in Pro</h3>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-foreground">
                <Check className="w-4 h-4 text-success mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {!user && (
          <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/auth?next=/pricing")}>
            Sign in to upgrade
          </Button>
        )}
      </div>
    </div>
  );
}
