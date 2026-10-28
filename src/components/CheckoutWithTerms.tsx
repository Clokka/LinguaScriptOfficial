import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";
import { Button } from "@/components/ui/button";
import { TERMS_VERSION } from "@/lib/terms";

interface Props {
  priceId: string;
  customerEmail?: string;
  userId?: string;
}

const SUPPORT_EMAIL = "rowan@linguascript.co.uk";

/**
 * Stripe checklist: the buyer ticks "I agree" before the payment form opens,
 * the tick is saved (terms_acceptances: who, which Terms version, when), and
 * the refund/cancellation policies and a support contact sit on the
 * checkout screen itself.
 */
export function CheckoutWithTerms({ priceId, customerEmail, userId }: Props) {
  const [agreed, setAgreed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continueToPayment = async () => {
    if (!agreed || !userId) return;
    setSaving(true);
    setError(null);
    // terms_acceptances is newer than the generated types, hence `as any`.
    const { error: saveError } = await (supabase as any).from("terms_acceptances").insert({
      user_id: userId,
      terms_version: TERMS_VERSION,
      context: "checkout",
    });
    setSaving(false);
    if (saveError) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setConfirmed(true);
  };

  return (
    <div className="w-full">
      {confirmed ? (
        <StripeEmbeddedCheckout priceId={priceId} customerEmail={customerEmail} userId={userId} />
      ) : (
        <div className="mx-auto max-w-md rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-white">
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[#7bbf27]"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline">Terms of Service</a>,
              including the{" "}
              <a href="/terms#refunds" target="_blank" rel="noopener noreferrer" className="underline">refund</a>{" "}
              and{" "}
              <a href="/terms#cancellation" target="_blank" rel="noopener noreferrer" className="underline">cancellation</a>{" "}
              policies. I understand Pro starts straight away.
            </span>
          </label>
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <Button
            onClick={continueToPayment}
            disabled={!agreed || saving || !userId}
            className="mt-4 w-full"
          >
            {saving ? "Saving…" : "Continue to payment"}
          </Button>
        </div>
      )}

      <nav
        aria-label="Policies"
        className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/50"
      >
        <a href="/terms" className="hover:text-white/80">Terms</a>
        <a href="/terms#refunds" className="hover:text-white/80">Refunds</a>
        <a href="/terms#cancellation" className="hover:text-white/80">Cancellation</a>
        <a href="/privacy" className="hover:text-white/80">Privacy</a>
        <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-white/80">Support: {SUPPORT_EMAIL}</a>
      </nav>
    </div>
  );
}
