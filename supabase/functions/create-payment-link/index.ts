// Generates a shareable Stripe Payment Link (one-time or subscription) the
// admin can send to a user. Uses the Lovable-managed Stripe gateway.
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const priceId = String(body?.priceId || "").trim();
    const environment = (body?.environment === "live" ? "live" : "sandbox") as StripeEnv;
    const email = body?.customerEmail ? String(body.customerEmail).trim() : undefined;
    const note = body?.note ? String(body.note).slice(0, 200) : undefined;

    if (!priceId) {
      return new Response(JSON.stringify({ error: "priceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (environment === "live" && !Deno.env.get("STRIPE_LIVE_API_KEY")) {
      return new Response(
        JSON.stringify({
          error:
            "Live Stripe is not connected yet. Complete Stripe go-live (Payments → Live) or switch the Environment selector to Sandbox to test.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = createStripeClient(environment);


    // Resolve human-readable priceId (lookup_key) → real Stripe price.
    let stripePriceId = priceId;
    if (!priceId.startsWith("price_")) {
      const prices = await stripe.prices.list({ lookup_keys: [priceId], limit: 1 });
      if (!prices.data.length) {
        return new Response(JSON.stringify({ error: `Price not found for "${priceId}"` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      stripePriceId = prices.data[0].id;
    }

    const price = await stripe.prices.retrieve(stripePriceId);
    const isRecurring = price.type === "recurring";

    const link = await stripe.paymentLinks.create({
      line_items: [{ price: stripePriceId, quantity: 1 }],
      ...(isRecurring
        ? { subscription_data: { metadata: { source: "admin_link", note: note ?? "" } } }
        : { payment_intent_data: { metadata: { source: "admin_link", note: note ?? "" } } }),
      metadata: {
        source: "admin_link",
        ...(email ? { intended_email: email } : {}),
        ...(note ? { note } : {}),
      },
      allow_promotion_codes: true,
    });

    return new Response(
      JSON.stringify({ url: link.url, id: link.id, recurring: isRecurring }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("create-payment-link error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
