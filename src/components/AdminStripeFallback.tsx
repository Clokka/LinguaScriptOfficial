import { useState } from "react";
import { CreditCard, Save, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  getStripeFallbackConfig,
  saveStripeFallbackConfig,
  type StripeFallbackConfig,
  type StripePlanKey,
} from "@/lib/stripeFallback";

const PLAN_ORDER: StripePlanKey[] = ["monthly", "yearly", "lifetime"];

export function AdminStripeFallback() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<StripeFallbackConfig>(() => getStripeFallbackConfig());

  const update = (key: StripePlanKey, patch: Partial<StripeFallbackConfig[StripePlanKey]>) => {
    setCfg((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  };

  const save = () => {
    saveStripeFallbackConfig(cfg);
    toast({
      title: "Stripe fallback saved",
      description: "Users will now see these plans on /pricing as a backup to RevenueCat.",
    });
  };

  return (
    <div className="glass-panel-strong p-6 rounded-2xl mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" /> Stripe Fallback Plans
        </h2>
        <a
          href="https://dashboard.stripe.com/products"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          Stripe products <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Paste your Stripe Price IDs (e.g. <code className="text-xs">price_1Q...</code>). When enabled,
        these appear on <code className="text-xs">/pricing</code> as a fallback if RevenueCat fails to load.
      </p>

      <div className="space-y-3">
        {PLAN_ORDER.map((key) => {
          const plan = cfg[key];
          return (
            <div key={key} className="grid grid-cols-1 sm:grid-cols-[120px_1fr_160px_80px] gap-2 items-center">
              <div className="text-sm font-medium text-foreground capitalize">{plan.label}</div>
              <Input
                placeholder="price_1Q..."
                value={plan.priceId}
                onChange={(e) => update(key, { priceId: e.target.value.trim() })}
                className="bg-secondary/50 border-border font-mono text-xs"
              />
              <Input
                placeholder="$9.99 / month"
                value={plan.priceDisplay}
                onChange={(e) => update(key, { priceDisplay: e.target.value })}
                className="bg-secondary/50 border-border text-xs"
              />
              <div className="flex items-center gap-2 justify-end">
                <Switch
                  checked={plan.enabled}
                  onCheckedChange={(v) => update(key, { enabled: v })}
                />
                <span className="text-xs text-muted-foreground">{plan.enabled ? "On" : "Off"}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-4">
        <Button variant="hero" onClick={save} className="gap-2">
          <Save className="w-4 h-4" /> Save fallback plans
        </Button>
      </div>
    </div>
  );
}
