import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BrandMark } from "@/components/BrandMark";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { getEnabledFallbackPlans, type StripeFallbackPlan, type StripePlanKey } from "@/lib/stripeFallback";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { isPaymentsConfigured } from "@/lib/stripe";
import { cn } from "@/lib/utils";

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

/**
 * Chameleon colours as brand accents, not deck state. `red` is deliberately
 * absent here — on a paywall it would read as "wrong answer" rather than
 * "buy this", carrying its learning-UI meaning somewhere it doesn't apply.
 */
const GREEN = "#34C759";
const ORANGE = "#FF8A00";

// RevenueCat is not wired to a real product catalog in this build (its
// configured key is a placeholder, not a live RC project), so Stripe — via
// the existing create-checkout edge function — is the one real paywall
// here rather than a "backup" shown only when RC fails.
//
// Everything below this comment is presentation only. The purchase logic —
// useSubscription, getEnabledFallbackPlans, isPaymentsConfigured, and
// StripeEmbeddedCheckout — is untouched from the fix that made Stripe the
// real paywall and corrected three bugs where a payment could succeed and
// the buyer still got nothing. This pass only changes how it looks.
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
    <div className="min-h-screen bg-[#0a0f0d] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6 text-white/60 hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>

        <div className="mb-10 text-center">
          <div className="mb-5 flex justify-center">
            <BrandMark size={44} />
          </div>

          <div className="mx-auto -mb-4 h-28 w-40" aria-hidden="true">
            <ChameleonMascot tier="green" party={isPro} className="h-full w-full" />
          </div>

          <h1 className="mb-3 text-4xl font-bold tracking-tight sm:text-5xl">
            Learn every language you want.
          </h1>
          <p className="mx-auto max-w-xl text-white/50">
            Unlock the whole library and switch between languages freely without losing your streak.
          </p>
        </div>

        {!subLoading && isPro && (
          <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-2xl border border-[#34C759]/30 bg-[#34C759]/10 p-6 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span
                  className="inline-flex h-5 w-5 items-center justify-center rounded-full"
                  style={{ backgroundColor: GREEN }}
                >
                  <Check className="h-3.5 w-3.5 text-[#0a0f0d]" strokeWidth={3} />
                </span>
                <h2 className="font-semibold text-white">You're on Pro</h2>
              </div>
              <p className="text-sm text-white/60">
                {source === "admin_grant"
                  ? `Granted by the LinguaScript team${expiresAt ? ` · expires ${new Date(expiresAt).toLocaleDateString()}` : " · lifetime"}`
                  : expiresAt
                    ? `Renews ${new Date(expiresAt).toLocaleDateString()}`
                    : "Active — thanks for supporting LinguaScript!"}
              </p>
            </div>
          </div>
        )}

        <div className="mb-10 grid gap-4 sm:grid-cols-3">
          {!stripeAvailable ? (
            <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/40">
              Payments aren't configured yet. Please check back soon.
            </div>
          ) : loadingPlans ? (
            <div className="col-span-full flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white/40" />
            </div>
          ) : plans.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.03] py-12 text-center text-sm text-white/40">
              No plans are available right now. Please check back soon.
            </div>
          ) : (
            plans.map((p) => {
              const badge = PLAN_BADGES[p.key];
              const highlighted = badge === "Best value";
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    if (!user) { navigate("/auth?next=/pricing"); return; }
                    setStripePriceId(p.priceId);
                  }}
                  disabled={isPro}
                  className={cn(
                    "relative rounded-2xl border p-6 text-left transition disabled:opacity-50",
                    highlighted
                      ? "border-[#FF8A00]/50 bg-[#FF8A00]/[0.07] hover:border-[#FF8A00]"
                      : "border-white/10 bg-white/[0.03] hover:border-[#34C759]/50",
                  )}
                >
                  {badge && (
                    <span
                      className="absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: highlighted ? ORANGE : GREEN,
                        color: "#0a0f0d",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                  <div className="mb-2 text-sm capitalize text-white/50">{p.label}</div>
                  <div className="mb-4 flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-white">{p.priceDisplay}</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-2 text-sm font-medium"
                    style={{ color: highlighted ? ORANGE : GREEN }}
                  >
                    <CreditCard className="h-4 w-4" />
                    {isPro ? "Already Pro" : "Pay with card"}
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="mb-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6">
          <h3 className="mb-4 font-semibold text-white">Everything in Pro</h3>
          <ul className="space-y-2">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/70">
                <Check className="mt-0.5 h-4 w-4 shrink-0" style={{ color: GREEN }} />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {!user && (
          <Button
            size="lg"
            className="w-full font-bold text-[#0a0f0d] hover:opacity-90"
            style={{ backgroundColor: GREEN }}
            onClick={() => navigate("/auth?next=/pricing")}
          >
            Sign in to upgrade
          </Button>
        )}
      </div>

      <Dialog open={!!stripePriceId} onOpenChange={(o) => { if (!o) setStripePriceId(null); }}>
        <DialogContent className="max-w-2xl border-white/10 bg-[#0f1714] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <BrandMark variant="pin" size={22} />
              Complete your purchase
            </DialogTitle>
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
