// Creates a real Stripe Product + Price via the API (using the same
// Lovable-managed Stripe key every other function already uses — no key
// ever needs to be pasted anywhere), then writes the result straight into
// payment_plans. Replaces "go click through the Stripe Dashboard, copy the
// price ID, paste it into /admin" with one request.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createStripeClient, type StripeEnv } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

type PlanKey = "monthly" | "yearly" | "lifetime";
const SORT_ORDER: Record<PlanKey, number> = { monthly: 1, yearly: 2, lifetime: 3 };
const INTERVAL: Record<PlanKey, "month" | "year" | null> = { monthly: "month", yearly: "year", lifetime: null };

function formatPriceDisplay(amount: number, currency: string, interval: "month" | "year" | null): string {
  const major = (amount / 100).toFixed(2);
  const symbol = currency.toLowerCase() === "gbp" ? "£" : currency.toLowerCase() === "eur" ? "€" : currency.toLowerCase() === "usd" ? "$" : `${currency.toUpperCase()} `;
  const price = `${symbol}${major}`;
  if (interval === "month") return `${price} / month`;
  if (interval === "year") return `${price} / year`;
  return `${price} one-time`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    // Mints real Stripe products/prices and writes payment_plans — the same
    // admin bar every other DB-side admin RPC enforces (has_role), not just
    // hiding the button in the UI.
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    const { data: { user } } = token
      ? await supabase.auth.getUser(token)
      : { data: { user: null } };
    if (!user) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const environment = (body?.environment === "live" ? "live" : "sandbox") as StripeEnv;
    const planKey = body?.planKey as PlanKey;
    const name = String(body?.name || "").trim();
    const currency = String(body?.currency || "gbp").trim().toLowerCase();
    const unitAmount = Number(body?.unitAmount);

    if (!["monthly", "yearly", "lifetime"].includes(planKey)) {
      return new Response(JSON.stringify({ error: "planKey must be monthly, yearly, or lifetime" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!name) {
      return new Response(JSON.stringify({ error: "name is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return new Response(JSON.stringify({ error: "unitAmount must be a positive number of minor currency units (e.g. pence)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (environment === "live" && !Deno.env.get("STRIPE_LIVE_API_KEY")) {
      return new Response(
        JSON.stringify({
          error:
            "Live Stripe is not connected yet. Complete Stripe go-live (Payments → Live) or switch Environment to Sandbox to test.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stripe = createStripeClient(environment);
    const interval = INTERVAL[planKey];

    const product = await stripe.products.create({ name });
    const price = await stripe.prices.create({
      product: product.id,
      currency,
      unit_amount: Math.round(unitAmount),
      ...(interval ? { recurring: { interval } } : {}),
    });

    const priceDisplay = formatPriceDisplay(unitAmount, currency, interval);

    // Only affects the environment's own /pricing + /upgrade rendering — the
    // sandbox/live split already lives in getStripeEnvironment() elsewhere,
    // so this writes whichever plan_key the admin picked regardless of
    // environment (same single-table shape the manual admin panel already
    // uses; this just fills it in via API instead of by hand).
    const { error: dbError } = await (supabase as any)
      .from("payment_plans")
      .upsert(
        {
          plan_key: planKey,
          label: planKey.charAt(0).toUpperCase() + planKey.slice(1),
          price_display: priceDisplay,
          price_id: price.id,
          enabled: true,
          sort_order: SORT_ORDER[planKey],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "plan_key" },
      );
    if (dbError) throw new Error(`Stripe product created (${price.id}) but saving to payment_plans failed: ${dbError.message}`);

    return new Response(
      JSON.stringify({ productId: product.id, priceId: price.id, priceDisplay }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("admin-create-stripe-plan error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
