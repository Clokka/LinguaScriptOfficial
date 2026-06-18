import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "@/hooks/use-toast";

const FEATURES = [
  "Unlimited learning languages — switch freely between French, Spanish, German, Italian and more",
  "Priority AI translations & faster word lookups",
  "Unlimited flashcards and spaced-repetition reviews",
  "Early access to every new feature we ship",
  "Support an indie team building for language learners",
];

const PLANS = [
  { id: "pro_monthly", label: "Monthly", price: "$9.99", suffix: "/ month", note: "Cancel anytime" },
  { id: "pro_yearly", label: "Yearly", price: "$79", suffix: "/ year", note: "Save 34% — 2 months free", badge: "Best value" },
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPro, source, loading, expiresAt } = useSubscription();
  const [selected, setSelected] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { environment: getStripeEnvironment(), returnUrl: `${window.location.origin}/pricing` },
      });
      if (error || !data?.url) throw new Error(error?.message || "Could not open billing portal");
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Portal unavailable", description: e.message, variant: "destructive" });
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PaymentTestModeBanner />
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
            Free keeps you focused on one language. Pro unlocks the whole library so you can switch
            between French today and Spanish tomorrow without losing your streak.
          </p>
        </div>

        {!loading && isPro && (
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
            {source === "subscription" && (
              <Button variant="glass" onClick={openPortal} disabled={portalLoading}>
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Manage billing
              </Button>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {PLANS.map((plan) => (
            <button
              key={plan.id}
              onClick={() => setSelected(plan.id)}
              className={`relative text-left glass-panel-strong p-6 rounded-2xl border transition ${
                selected === plan.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
              }`}
            >
              {plan.badge && (
                <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wider bg-accent text-accent-foreground px-2 py-0.5 rounded-full">
                  {plan.badge}
                </span>
              )}
              <div className="text-sm text-muted-foreground mb-2">{plan.label}</div>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                <span className="text-sm text-muted-foreground">{plan.suffix}</span>
              </div>
              <div className="text-xs text-muted-foreground">{plan.note}</div>
            </button>
          ))}
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

        {!user ? (
          <Button variant="hero" size="lg" className="w-full" onClick={() => navigate("/auth?next=/pricing")}>
            Sign in to upgrade
          </Button>
        ) : selected ? (
          <div className="glass-panel-strong p-4 rounded-2xl">
            <StripeEmbeddedCheckout
              priceId={selected}
              userId={user.id}
              customerEmail={user.email ?? undefined}
            />
          </div>
        ) : (
          <Button variant="hero" size="lg" className="w-full" disabled>
            Choose a plan above to continue
          </Button>
        )}
      </div>
    </div>
  );
}
