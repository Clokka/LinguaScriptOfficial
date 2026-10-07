import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return _supabase;
}

function isoFromUnix(s: number | null | undefined): string | null {
  return s ? new Date(s * 1000).toISOString() : null;
}

function resolvePriceId(price: any): string | null {
  return price?.lookup_key || price?.metadata?.lovable_external_id || price?.id || null;
}

async function upsertSubscription(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata", subscription.id);
    return;
  }
  const item = subscription.items?.data?.[0];
  const priceId = resolvePriceId(item?.price);
  const productId = typeof item?.price?.product === "string" ? item.price.product : item?.price?.product?.id;
  const periodStart = item?.current_period_start ?? subscription.current_period_start;
  const periodEnd = item?.current_period_end ?? subscription.current_period_end;

  await getSupabase().from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: isoFromUnix(periodStart),
      current_period_end: isoFromUnix(periodEnd),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment: env,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );
}

async function markCanceled(subscription: any, env: StripeEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);
}

// Subscriptions grant Pro via sync_pro_from_subscription (a DB trigger on the
// subscriptions table, fired by upsertSubscription above). A one-time/
// "lifetime" Checkout Session has no subscription object at all, so nothing
// upstream ever wrote is_pro for it — the charge succeeded in Stripe but the
// buyer was never actually granted Pro in the app. Grant it here directly,
// the same way admin/lifetime grants already work (a permanent flag, no
// expiry), guarded so it only fires for a completed, paid, non-recurring
// session with a known userId.
async function grantOneTimePro(session: any) {
  if (session.mode !== "payment" || session.payment_status !== "paid") return;
  const userId = session.metadata?.userId;
  if (!userId) {
    console.error("checkout.session.completed (payment) with no userId in metadata", session.id);
    return;
  }
  await getSupabase()
    .from("profiles")
    .update({ is_pro: true, pro_source: "stripe_one_time", pro_expires_at: null })
    .eq("user_id", userId);
}

// A subscription's renewal invoices are generated automatically, outside the
// checkout flow — if the customer's saved address ever becomes insufficient
// for Stripe Tax to calculate tax, the invoice can't finalize and the
// subscription just silently stops being billed. Flag it so it shows up in
// /admin instead of only in function logs nobody watches.
async function flagTaxIssue(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  if (invoice.automatic_tax?.status !== "requires_location_inputs") return;

  console.error(
    "Tax finalization failed — customer's address is insufficient for tax calculation",
    { invoiceId: invoice.id, subscriptionId },
  );
  await getSupabase()
    .from("subscriptions")
    .update({ tax_location_invalid: true, tax_issue_detected_at: new Date().toISOString() })
    .eq("stripe_subscription_id", subscriptionId);
}

// A paid invoice on a previously-flagged subscription means the address (or
// whatever else was blocking finalization) has since been fixed — clear it.
async function clearTaxIssue(invoice: any) {
  const subscriptionId = invoice.subscription;
  if (!subscriptionId) return;
  await getSupabase()
    .from("subscriptions")
    .update({ tax_location_invalid: false })
    .eq("stripe_subscription_id", subscriptionId)
    .eq("tax_location_invalid", true);
}

const SITE_URL = "https://linguascript.co.uk";

// Hands a template to send-transactional-email, which checks the suppression
// list and queues it. The idempotencyKey stops Stripe's webhook retries from
// sending the same email twice.
async function sendEmail(templateName: string, recipientEmail: string, idempotencyKey: string, templateData: Record<string, unknown>) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${url}/functions/v1/send-transactional-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}`, "apikey": key },
    body: JSON.stringify({ templateName, recipientEmail, idempotencyKey, templateData }),
  });
  if (!res.ok) console.error("Failed to send email", templateName, res.status, await res.text());
}

// Best-effort friendly name + email for a userId from checkout metadata.
async function lookupUser(userId: string | undefined) {
  if (!userId) return { email: null as string | null, name: undefined as string | undefined, isPro: false };
  const [{ data: authData }, { data: profile }] = await Promise.all([
    getSupabase().auth.admin.getUserById(userId),
    getSupabase().from("profiles").select("display_name, is_pro").eq("user_id", userId).maybeSingle(),
  ]);
  const displayName = (profile as any)?.display_name;
  return {
    email: authData?.user?.email ?? null,
    name: displayName && !String(displayName).includes("@") ? String(displayName) : undefined,
    isPro: !!(profile as any)?.is_pro,
  };
}

// Abandoned / declined checkout. Stripe expires an unpaid Checkout Session
// after 24h — this covers both "card was declined and they gave up" and "they
// closed the page". Send one recovery email, unless they've since bought Pro
// through another session.
async function sendCheckoutRecovery(session: any) {
  if (session.payment_status === "paid") return;
  const user = await lookupUser(session.metadata?.userId);
  if (user.isPro) return;
  const email = session.customer_details?.email || session.customer_email || user.email;
  if (!email) {
    console.log("checkout.session.expired with no email to follow up", session.id);
    return;
  }
  await sendEmail("checkout-recovery", email, `checkout-recovery-${session.id}`, {
    name: user.name,
    retryUrl: `${SITE_URL}/upgrade`,
  });
}

// A renewal charge failed. Stripe retries the card itself; we email once per
// invoice (on the first failed attempt) so the customer can update their card.
// Stripe fires trial_will_end three days before a trial converts. The honest
// reminder promised at checkout: when it ends, and how to cancel.
async function sendTrialEnding(subscription: any) {
  if (subscription.status !== "trialing" || !subscription.trial_end) return;
  const user = await lookupUser(subscription.metadata?.userId);
  if (!user.email) {
    console.log("trial_will_end with no email to remind", subscription.id);
    return;
  }
  const endDate = new Date(subscription.trial_end * 1000)
    .toLocaleDateString("en-GB", { day: "numeric", month: "long" });
  await sendEmail("trial-ending", user.email, `trial-ending-${subscription.id}`, {
    name: user.name,
    endDate,
    manageUrl: `${SITE_URL}/profile`,
  });
}

// First-time subscription invoices are skipped — those failures happen inside
// checkout and are covered by sendCheckoutRecovery when the session expires.
async function sendRenewalPaymentFailed(invoice: any) {
  if (invoice.billing_reason === "subscription_create") return;
  if ((invoice.attempt_count ?? 1) > 1) return;
  const userId = invoice.subscription_details?.metadata?.userId
    ?? invoice.parent?.subscription_details?.metadata?.userId;
  const user = await lookupUser(userId);
  const email = invoice.customer_email || user.email;
  if (!email) {
    console.log("invoice.payment_failed with no email to follow up", invoice.id);
    return;
  }
  await sendEmail("renewal-payment-failed", email, `renewal-payment-failed-${invoice.id}`, {
    name: user.name,
    billingUrl: `${SITE_URL}/profile`,
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const rawEnv = new URL(req.url).searchParams.get("env");
  if (rawEnv !== "sandbox" && rawEnv !== "live") {
    return new Response(JSON.stringify({ received: true, ignored: "invalid env" }), { status: 200 });
  }
  const env: StripeEnv = rawEnv;
  try {
    const event = await verifyWebhook(req, env);
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
        await upsertSubscription(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await markCanceled(event.data.object, env);
        break;
      case "checkout.session.completed":
        await grantOneTimePro(event.data.object);
        break;
      case "invoice.finalization_failed":
        await flagTaxIssue(event.data.object);
        break;
      case "invoice.paid":
        await clearTaxIssue(event.data.object);
        break;
      case "checkout.session.expired":
        await sendCheckoutRecovery(event.data.object);
        break;
      case "invoice.payment_failed":
        await sendRenewalPaymentFailed(event.data.object);
        break;
      case "customer.subscription.trial_will_end":
        await sendTrialEnding(event.data.object);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});
