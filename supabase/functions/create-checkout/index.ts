import { createClient } from "npm:@supabase/supabase-js@2";
import { type StripeEnv, createStripeClient } from "../_shared/stripe.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const STUDENT_COUPON_ID = "student50";

function isAcademicEmail(email: string | undefined | null): boolean {
  const domain = email?.split("@")[1]?.toLowerCase() ?? "";
  if (!domain) return false;
  if (/\.(ac\.uk|edu|edu\.au|edu\.in|ac\.nz|edu\.sg|ac\.th|edu\.hk|ac\.jp)$/.test(domain)) return true;
  const sub = domain.split(".")[0];
  return ["uni", "university", "college", "students", "student"].includes(sub);
}

// 50% student discount, created once per environment and reused after that.
async function ensureStudentCoupon(stripe: ReturnType<typeof createStripeClient>): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(STUDENT_COUPON_ID);
    return existing.id;
  } catch {
    const created = await stripe.coupons.create({
      id: STUDENT_COUPON_ID,
      percent_off: 50,
      duration: "forever",
      name: "Student 50% off",
    });
    return created.id;
  }
}

async function resolveOrCreateCustomer(
  stripe: ReturnType<typeof createStripeClient>,
  options: { email?: string; userId?: string },
): Promise<string> {
  if (options.userId && !/^[a-zA-Z0-9_-]+$/.test(options.userId)) {
    throw new Error("Invalid userId");
  }
  if (options.userId) {
    const found = await stripe.customers.search({
      query: `metadata['userId']:'${options.userId}'`,
      limit: 1,
    });
    if (found.data.length) return found.data[0].id;
  }
  if (options.email) {
    const existing = await stripe.customers.list({ email: options.email, limit: 1 });
    if (existing.data.length) {
      const customer = existing.data[0];
      if (options.userId && customer.metadata?.userId !== options.userId) {
        await stripe.customers.update(customer.id, {
          metadata: { ...customer.metadata, userId: options.userId },
        });
      }
      return customer.id;
    }
  }
  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    ...(options.userId && { metadata: { userId: options.userId } }),
  });
  return created.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const { priceId, quantity, customerEmail, returnUrl, environment } = await req.json();

    // A client-supplied userId is never trustworthy on its own — anyone can
    // call this function directly with an arbitrary id and bind a Stripe
    // subscription to an account they don't own (the payments webhook trusts
    // this metadata to flip profiles.is_pro). Derive it from the caller's own
    // verified JWT instead; no valid token means no userId at all, so
    // anonymous email-only checkout still works exactly as before.
    let userId: string | undefined;
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    }

    if (!priceId || !/^[a-zA-Z0-9_-]+$/.test(priceId)) throw new Error("Invalid priceId");
    const env: StripeEnv = environment === "live" ? "live" : "sandbox";
    const stripe = createStripeClient(env);

    // Accept either a raw Stripe Price ID (what the admin UI's own
    // placeholder text tells people to paste, e.g. "price_1Q...") or a
    // lookup_key — this only ever resolved lookup_keys before, so a plan
    // configured with a real Price ID (the common/intuitive case) would
    // fail here with "Price not found" while working fine in the sibling
    // create-payment-link function, which already handled both forms.
    const stripePrice = priceId.startsWith("price_")
      ? await stripe.prices.retrieve(priceId)
      : (await stripe.prices.list({ lookup_keys: [priceId] })).data[0];
    if (!stripePrice) throw new Error("Price not found");
    const isRecurring = stripePrice.type === "recurring";

    const customerId = (customerEmail || userId)
      ? await resolveOrCreateCustomer(stripe, { email: customerEmail, userId })
      : undefined;

    let productDescription: string | undefined;
    if (!isRecurring) {
      const productId = typeof stripePrice.product === "string" ? stripePrice.product : stripePrice.product.id;
      const product = await stripe.products.retrieve(productId);
      productDescription = product.name;
    }

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: quantity || 1 }],
      mode: isRecurring ? "subscription" : "payment",
      ui_mode: "embedded_page",
      return_url: returnUrl,
      ...(customerId && { customer: customerId }),
      ...(!isRecurring && { payment_intent_data: { description: productDescription } }),
      ...(userId && {
        metadata: { userId },
        ...(isRecurring && { subscription_data: { metadata: { userId } } }),
      }),
      managed_payments: { enabled: true },
    } as any);

    return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-checkout error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
