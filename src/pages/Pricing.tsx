import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { getEnabledFallbackPlans, type StripeFallbackPlan, type StripePlanKey } from "@/lib/stripeFallback";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";

const FEATURES = [
  "Unlimited learning languages — switch freely between French, Spanish, German, Italian and more",
  "Priority AI translations & faster word lookups",
  "Unlimited flashcards and spaced-repetition reviews",
  "Early access to every new feature we ship",
  "Support an indie team building for language learners",
];

const PLAN_BADGES: Record<string, string | undefined> = {
  yearly: "Best value",
  lifetime: "Pay once",
};

// RevenueCat is not wired to a real product catalog in this build (its
// configured key is a placeholder, not a live RC project), so Stripe — via
// the existing create-checkout edge function — is the one real paywall
// here rather than a "backup" shown only when RC fails.
export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, source, loading: subLoading, expiresAt } = useSubscription();
  const [stripePriceId, setStripePriceId] = useState<string | null>(null);
  const [plans, setPlans] = useState<Array<{ key: StripePlanKey } & StripeFallbackPlan>>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const stripeAvailable = isPaymentsConfigured();

  useEffect(() => {
    let alive = true;
    getEnabledFallbackPlans().then((p) => { if (alive) { setPlans(p); setLoadingPlans(false); } });
    return () => { alive = false; };
  }, []);

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
                    : "Active — thanks for supporting LinguaScript!"}
              </p>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4 mb-10">
          {!stripeAvailable ? (
            <div className="col-span-full text-center text-muted-foreground py-12 text-sm">
              Payments aren't configured yet. Please check back soon.
            </div>
          ) : loadingPlans ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : plans.length === 0 ? (
            <div className="col-span-full text-center text-muted-foreground py-12 text-sm">
              No plans are available right now. Please check back soon.
            </div>
          ) : (
            plans.map((p) => (
              <button
                key={p.key}
                onClick={() => {
                  if (!user) { navigate("/auth?next=/pricing"); return; }
                  setStripePriceId(p.priceId);
                }}
                disabled={isPro}
                className="relative text-left glass-panel-strong p-6 rounded-2xl border border-border hover:border-primary/40 transition disabled:opacity-60"
              >
                {PLAN_BADGES[p.key] && (
                  <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                    {PLAN_BADGES[p.key]}
                  </span>
                )}
                <div className="text-sm text-muted-foreground mb-2 capitalize">{p.label}</div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-3xl font-bold text-foreground">{p.priceDisplay}</span>
                </div>
                <div className="text-sm font-medium text-primary inline-flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  {isPro ? "Already Pro" : "Pay with card"}
                </div>
              </button>
            ))
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

      <Dialog open={!!stripePriceId} onOpenChange={(o) => { if (!o) setStripePriceId(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Complete your purchase</DialogTitle>
          </DialogHeader>
          {stripePriceId && (
            <StripeEmbeddedCheckout
              priceId={stripePriceId}
              customerEmail={user?.email ?? undefined}
              userId={user?.id}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
