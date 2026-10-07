# Roadmap

- [x] Fix public.payment_plans visibility and Stripe Plans admin persistence
- [x] Configure and enable Monthly, Yearly, and Lifetime Stripe plans
- [x] Remove the incomplete RevenueCat integration
- [x] Move embedded checkout to a native full-page scroll surface on mobile and desktop
- [x] Restore a balanced responsive level-up chameleon size

- [x] Fix chameleon clipping (word-saved + level-up)
- [x] Watch page: 'Words saved X/goal' bar under video with Review in Flashcards button (no forced stop)
- [ ] Level downgrade (e.g. C1→B1): decide what happens to stored words (waiting on user)
- [ ] Later (not started): RevenueCat as the single "who is Pro" source across web + iOS + Android. Connect Stripe in the RevenueCat dashboard, `pro` entitlement, a `revenuecat-webhook` function that sets `profiles.is_pro` (secrets `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH`), and in-app purchases with the same 14-day trial in `mobile/`.
