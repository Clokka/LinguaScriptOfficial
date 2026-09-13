import { useState } from "react";
import { toast } from "sonner";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { cn } from "@/lib/utils";

/**
 * Opens the hosted billing portal so a paying customer can change their card,
 * download invoices, or cancel. Must open in a new tab — the portal refuses to
 * render inside an iframe (including the Lovable preview pane).
 */
export function ManageBillingButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const open = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: { returnUrl: window.location.href, environment: getStripeEnvironment() },
      });
      if (error || !data?.url) throw new Error(data?.error || error?.message || "Could not open billing");
      window.open(data.url as string, "_blank", "noopener");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message.includes("No subscription")
          ? "No card subscription found on this account."
          : "Couldn't open the billing page. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={open}
      disabled={loading}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:opacity-60",
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
      Manage billing
    </button>
  );
}
