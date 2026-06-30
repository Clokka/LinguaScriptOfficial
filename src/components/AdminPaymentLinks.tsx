import { useState } from "react";
import { Link2, Copy, Check, Loader2, ExternalLink } from "lucide-react";
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
import { getStripeFallbackConfig, type StripePlanKey } from "@/lib/stripeFallback";

const PLAN_KEYS: StripePlanKey[] = ["monthly", "yearly", "lifetime"];

export function AdminPaymentLinks() {
  const { toast } = useToast();
  const cfg = getStripeFallbackConfig();
  const [plan, setPlan] = useState<StripePlanKey>("monthly");
  const [customPriceId, setCustomPriceId] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "live">("live");
  const [loading, setLoading] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    const priceId = customPriceId.trim() || cfg[plan].priceId.trim();
    if (!priceId) {
      toast({
        title: "Missing price ID",
        description: "Set a Stripe Price ID for this plan above, or paste one below.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setLink(null);
    try {
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          priceId,
          environment,
          customerEmail: email || undefined,
          note: note || undefined,
        },
      });
      if (error) throw error;
      if (!data?.url) throw new Error(data?.error || "No link returned");
      setLink(data.url);
      toast({ title: "Payment link ready", description: "Copy and send it to your user." });
    } catch (e: any) {
      toast({
        title: "Failed to create link",
        description: e?.message || "Check the price ID and Stripe go-live status.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="glass-panel-strong p-6 rounded-2xl mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">One-Time Payment Links</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Generates a shareable Stripe Checkout link for the selected plan. Use{" "}
        <span className="font-medium text-foreground">Live</span> to charge real money — requires
        Stripe go-live to be complete.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label className="text-xs text-muted-foreground">Plan</Label>
          <Select value={plan} onValueChange={(v) => setPlan(v as StripePlanKey)}>
            <SelectTrigger className="bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLAN_KEYS.map((k) => (
                <SelectItem key={k} value={k} className="capitalize">
                  {cfg[k].label} {cfg[k].priceDisplay ? `— ${cfg[k].priceDisplay}` : ""}
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
              <SelectItem value="live">Live (real money)</SelectItem>
              <SelectItem value="sandbox">Sandbox (test mode)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <Label className="text-xs text-muted-foreground">Override price ID (optional)</Label>
          <Input
            placeholder="price_1Q... or lookup_key"
            value={customPriceId}
            onChange={(e) => setCustomPriceId(e.target.value)}
            className="bg-secondary/50 border-border font-mono text-xs"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Customer email (optional)</Label>
          <Input
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-secondary/50 border-border"
          />
        </div>
      </div>

      <div className="mb-3">
        <Label className="text-xs text-muted-foreground">Internal note (optional)</Label>
        <Input
          placeholder="e.g. promo for Alice"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="bg-secondary/50 border-border"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="hero" onClick={generate} disabled={loading} className="gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          Generate payment link
        </Button>
      </div>

      {link && (
        <div className="mt-4 p-3 rounded-lg bg-secondary/40 border border-border">
          <div className="flex items-center gap-2">
            <Input readOnly value={link} className="bg-background border-border font-mono text-xs" />
            <Button size="sm" variant="outline" onClick={copy} className="gap-1">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <a href={link} target="_blank" rel="noreferrer">
              <Button size="sm" variant="outline" className="gap-1">
                Open <ExternalLink className="w-3.5 h-3.5" />
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Send this link to your user. They pay through Stripe Checkout; on success the Stripe
            webhook records the subscription in your database.
          </p>
        </div>
      )}
    </div>
  );
}
