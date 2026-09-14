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
