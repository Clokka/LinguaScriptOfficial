# Catalog visibility, billing link, and the progression roadmap

_Coordination note from a Claude Code session working in parallel on branch
`claude/onboarding-discover-bugs-dgdtwy` (PR #22, open, not yet merged as of
2026-09-14). Leaving this here so the next Lovable session has the same
context instead of re-discovering or reverting it._

## Audit findings

- The `contentLengthPolicy` hard cap added in #19 (20 min max) turned out
  stricter than the real curated catalog — most existing admin-curated videos
  (vlogs, interviews, documentary-style lessons) run longer than 20 minutes,
  so the filter was silently emptying Discover and the Home rows on every
  surface that applies it (`Browse.tsx`, `HomeCatalogRows.tsx`,
  `DiscoverCatalog.tsx`). Reported by the user as "pages not showing content
  anymore."
- `Profile.tsx`'s `BillingSection` gated "Manage billing" on
  `isPro && hasBillingAccount`. Once a subscription lapses (cancelled,
  access period ended), `isPro` flips false and the button vanished
  completely even though Stripe still has the customer on file — no way to
  see invoice history or resubscribe. Reported as "no button anymore in
  profile to edit the payment plan."
- The onboarding guided tour (`TourOverlay.tsx`) had a click-to-advance rule
  that matched on merely *opening* the native/learning language `<Select>`,
  not on a value being chosen — it advanced the tour ~60ms after the
  dropdown opened, and the next step's click-guard then ate the click on the
  actual language option. Only worked if the user picked a language inside
  that ~60ms window.
- `InteractiveDemo.tsx` (onboarding "learn by doing") scheduled `setTimeout`s
  per stage that were never tracked/cleared, so a stray timer from an
  earlier stage could still fire after the user moved on, occasionally
  desyncing the fullscreen button's disabled state from what was rendered.
- Discover's language picker listed every supported language instead of only
  the ones in the learner's own `language_profiles` rows, and had a manual
  "All levels" CEFR dropdown that did nothing by default — raising a CEFR
  level in Profile never actually surfaced harder content in Discover.

## What's fixed (on PR #22, not yet on `main`)

- `contentLengthPolicy.ts`: cap raised 20 → 45 minutes.
- `Profile.tsx`: billing link now shows whenever `hasBillingAccount` is true,
  independent of current `isPro`; added a visible fallback message for the
  one remaining genuine-anomaly case (Pro, not lifetime/gifted, no billing
  account on file) instead of rendering nothing.
- `TourOverlay.tsx`: the generic click-to-advance handler now skips
  `settings-native` and `settings-learning` (same pattern already used for
  `watch-fullscreen`), leaving their existing `onOpenChange`-driven advance
  as the only trigger.
- `InteractiveDemo.tsx`: stage timers are tracked in a ref and cleared on
  every `advance()` and on unmount.
- `DiscoverCatalog.tsx`: language picker now reads `listLanguageProfiles`
  instead of the full language list; removed the manual CEFR dropdown;
  results are ordered toward the learner's real per-language `cefr_level`
  instead of a filter that did nothing by default.
- `PetCelebration.tsx`: level-up chameleon shrunk further, 240/280px →
  190/220px (on top of the earlier 320 → 240/280 pass already on `main`).
- `useSubscription.tsx`: refetches on tab focus/visibility so returning from
  the Stripe billing portal (a separate tab) reliably reflects a
  cancellation instead of depending solely on realtime websocket timing.

**Please don't re-introduce a hard content-length cutoff below ~45 minutes,
and don't re-add an `isPro` requirement to the billing-portal link** —
both were the direct cause of the two regressions above.

## Direction / roadmap (for awareness, not yet built)

Longer-term product direction discussed with the user, so future Lovable
work stays aligned instead of building something that conflicts:

1. **Progressive difficulty loop** — a learner watches a video (~10 min),
   and if their vocabulary comprehension for that language rises by roughly
   15%+, they unlock a harder video next; this repeats up through advanced
   content. After a video, ask if they enjoyed it / want to adjust their
   topics — feed that back into what gets recommended next. This PR lays
   only the first brick (CEFR-based ordering off the real per-language
   profile in Discover) — the actual unlock-on-comprehension-gain engine,
   the post-video feedback prompt, and the recommendation feedback loop are
   still unbuilt.
2. **YouTube Data API for Discover** — explicitly deferred by the user for
   now (discussed, not started). Worth scoping as its own piece of work
   later rather than folded into a bug-fix pass.

## Fix prompt

If picking this up fresh: verify Discover and the Home page show content
again on the current catalog, verify "Manage billing" stays visible for an
account whose Stripe subscription has lapsed, and verify raising a CEFR
level in Profile → My Languages visibly reorders Discover toward harder
content for that language. Do not lower `MAX_LESSON_SECONDS` back toward 20
minutes or re-gate the billing link on `isPro` without checking with the
user first — both directly caused the regressions this note documents.
