import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { StripePlanKey } from "@/lib/stripeFallback";

const PLAN_KEYS: StripePlanKey[] = ["monthly", "yearly", "lifetime"];

/**
 * Creates a real Stripe Product + Price directly via the API — no Dashboard
 * clicking, no pasting a price ID by hand. Writes the result straight into
 * payment_plans, the same table the "Stripe Plans" panel above manages.
 */
export function AdminCreateStripePlan() {
  const { toast } = useToast();
  const [plan, setPlan] = useState<StripePlanKey>("monthly");
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(""); // major units, e.g. "4.99"
  const [currency, setCurrency] = useState("gbp");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ priceId: string; priceDisplay: string } | null>(null);

  const create = async () => {
    const major = parseFloat(amount);
    if (!name.trim()) {
      toast({ title: "Missing name", description: "Give the product a name.", variant: "destructive" });
      return;
    }
    if (!Number.isFinite(major) || major <= 0) {
      toast({ title: "Invalid amount", description: "Enter a positive price, e.g. 4.99.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-stripe-plan", {
        body: {
          planKey: plan,
          environment,
          name: name.trim(),
          currency,
          unitAmount: Math.round(major * 100),
        },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          const body = ctx && typeof ctx.json === "function" ? await ctx.json() : null;
          if (body?.error) msg = body.error;
        } catch {}
        throw new Error(msg);
      }
      if (!data?.priceId) throw new Error(data?.error || "No price returned");
      setResult({ priceId: data.priceId, priceDisplay: data.priceDisplay });
      toast({
        title: "Plan created",
        description: `${data.priceDisplay} is now live on /pricing and /upgrade for the ${plan} slot.`,
      });
    } catch (e: any) {
      toast({
        title: "Failed to create plan",
        description: e?.message || "Check the details and try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel-strong p-6 rounded-2xl mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Wand2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Create a Stripe plan via API</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Creates the Product and Price directly in Stripe and saves it to the plan slot below — no
        need to go into the Stripe Dashboard. Use <span className="font-medium text-foreground">Live</span>{" "}
        only once Stripe go-live is complete.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label className="text-xs text-muted-foreground">Plan slot</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as StripePlanKey)}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_KEYS.map((k) => (
                <SelectItem key={k} value={k} className="capitalize">
                  {k} {k === "monthly" ? "(billed monthly)" : k === "yearly" ? "(billed yearly)" : "(one-time)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Environment</Label>
          <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "live")}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">Sandbox (test mode)</SelectItem>
              <SelectItem value="live">Live (real money)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="sm:col-span-2">
          <Label className="text-xs text-muted-foreground">Product name</Label>
          <Input
            placeholder="e.g. LinguaScript Pro — Yearly"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-secondary/50 border-border"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Currency</Label>
          <Input
            value={currency}
            onChange={(e) => setCurrency(e.target.value.toLowerCase().slice(0, 3))}
            className="bg-secondary/50 border-border uppercase"
          />
        </div>
      </div>

      <div className="mb-4">
        <Label className="text-xs text-muted-foreground">Price ({currency.toUpperCase()}, e.g. 4.99)</Label>
        <Input
          inputMode="decimal"
          placeholder="4.99"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          className="bg-secondary/50 border-border sm:w-40"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="hero" onClick={create} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
          Create in Stripe
        </Button>
      </div>

      {result && (
        <div className="mt-4 p-3 rounded-lg bg-secondary/40 border border-border text-sm">
          <p className="text-foreground font-medium">{result.priceDisplay}</p>
          <p className="text-xs text-muted-foreground font-mono mt-1">{result.priceId}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Saved to the <span className="font-medium text-foreground">{plan}</span> slot and enabled —
            it'll show up on /pricing and /upgrade immediately.
          </p>
        </div>
      )}
    </div>
  );
}
