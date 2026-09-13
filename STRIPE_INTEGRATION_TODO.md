# Stripe Integration — Status

Scenario A applied: an existing Checkout Session call was found and updated in place.

**File:** [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts)

## Deviations from the Checkout Studio config — read this first

Two `fixed_by_ui` values from the Checkout Studio config were **deliberately not applied**, because applying them as specified would have broken the existing, working checkout flow rather than making a minimal change:

| Field | Spec said | Kept instead | Why |
|-------|-----------|--------------|-----|
| `ui_mode` | `hosted_page` (redirect to a Stripe-hosted page) | `embedded_page` | This app embeds Stripe Checkout directly in `/pricing` and `/upgrade` via `StripeEmbeddedCheckout.tsx` (`@stripe/react-stripe-js`'s `EmbeddedCheckoutProvider`), which consumes `session.client_secret`. `hosted_page` mode returns a `session.url` to redirect to instead — no `client_secret` — which would silently break the embedded checkout dialog on both pages. |
| `integration_identifier` / `origin_context` | `hosted_mobile_app_0001` / `mobile_app` | *(omitted entirely)* | These values are mobile-app-specific, and there is no Stripe checkout integration anywhere in this repo's `mobile/` (Expo) app — this web app's `create-checkout` function is the only Checkout Session call that exists. This Checkout Studio config looks like it may have been set up for a different (mobile) integration target than this conversation's actual app. If you *do* have a mobile Stripe integration planned, it needs its own separate implementation in `mobile/`, not these fields bolted onto the web checkout call. |

If you did intend for this web app's checkout to redirect to a hosted Stripe page instead of the embedded dialog, say so explicitly and I'll make that (larger) change deliberately, including reworking `StripeEmbeddedCheckout.tsx`, `Pricing.tsx`, and `Upgrade.tsx` to redirect instead of embed.

## Values to Replace

None. The `sample_only` fields (`mode`, `line_items`) already had real, dynamic values in this codebase before this change — they were preserved as-is, not overwritten with placeholders:
- `mode` is computed from the actual Stripe Price (`isRecurring ? "subscription" : "payment"`)
- `line_items` uses the real, caller-supplied Stripe Price ID
- This integration uses `return_url` (required for `embedded_page` mode), not `success_url`/`cancel_url` — those are hosted-mode-only fields and don't apply here.

## Configured Parameters

These parameters were added from the Checkout Studio config and are now set on every Checkout Session this function creates:

| Parameter | Value |
|-----------|-------|
| `billing_address_collection` | `"auto"` |
| `phone_number_collection` | `{ enabled: false }` |
| `automatic_tax` | `{ enabled: false }` |
| `allow_promotion_codes` | `false` |
| `submit_type` | `"auto"` |
| `payment_method_collection` | `"always"` (only when `mode` is `"subscription"`, per the spec's own rule) |

## Setup notes

- **Stripe keys are not in `.env`** — this project routes Stripe calls through Lovable's managed connector gateway (`supabase/functions/_shared/stripe.ts`), using `STRIPE_SANDBOX_API_KEY` / `STRIPE_LIVE_API_KEY` / `LOVABLE_API_KEY` and `PAYMENTS_SANDBOX_WEBHOOK_SECRET` / `PAYMENTS_LIVE_WEBHOOK_SECRET` as Supabase Edge Function secrets, not raw `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET` env vars. Nothing needs to change here.
- **Stripe SDK version:** `stripe@22.0.2` (well above the 21.0.0 cutoff mentioned in the versioning rule — relevant only if `ui_mode` is ever switched to hosted mode later).
- **Frontend publishable key:** `VITE_PAYMENTS_CLIENT_TOKEN` (already correctly `VITE_`-prefixed for Vite) — separate from this server-side change, already working.
- **Testing:** use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC, in Stripe **test mode**.
- **Resources:** https://support.stripe.com, https://docs.stripe.com/mcp
