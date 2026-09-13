# Mobile checkout scroll and level-up chameleon sizing

## Audit findings

- The payment form is inside a centered dialog with no viewport height limit and no scrolling container. On short mobile screens, the embedded Stripe form extends below the visible area while the dialog prevents the page behind it from scrolling. This is why the final payment controls cannot be reached.
- The level-up chameleon uses a fixed 320 × 320 canvas. The recent animation repair did not deliberately enlarge it; it cloned the 3D model so concurrent celebrations no longer made it disappear. Now that it renders reliably, the existing 320px takeover is visibly oversized on mobile.

## Implementation

1. **Make checkout fully usable on mobile**
   - Turn the checkout dialog into a full-height mobile sheet using the dynamic viewport height.
   - Give the dialog its own vertical scrolling area with momentum scrolling and safe-area spacing.
   - Keep the title and close control reachable while allowing the entire Stripe form, including the payment button, to scroll into view.
   - Retain the current centered, constrained dialog on larger screens, but add a maximum height and internal scrolling for short desktop windows too.
   - Do not alter prices, checkout creation, authentication, or payment confirmation logic.

2. **Restore a balanced level-up chameleon size**
   - Reduce the level-up animation from the fixed 320px presentation to approximately 240px on phones and 280px on larger screens.
   - Keep the current model-cloning fix, animation clips, timing, confetti, and level text unchanged.
   - Keep the smaller word-saved animation unchanged.

3. **Verification**
   - Test the checkout at the current 384 × 626 mobile viewport and confirm the bottom of the Stripe form and payment button are reachable by scrolling.
   - Check a short desktop viewport to confirm the dialog remains usable without overflowing the screen.
   - Trigger a level-up preview on mobile and desktop and confirm the chameleon is centered, fully visible, and no longer dominates the screen.
   - Confirm the project typecheck and preview build remain clean.

## Fix prompt

Fix two focused UI regressions without changing payment or progression business logic. First, make the embedded Stripe checkout dialog fit within `100dvh` on mobile and provide an internal touch-friendly vertical scroll area with safe-area padding, while preserving a centered max-height dialog on desktop. The user must be able to reach and press Stripe’s final payment button at 384 × 626. Second, reduce only the full-screen level-up pet canvas from 320px to a responsive 240px mobile / 280px desktop presentation. Preserve the recent independent 3D-model clone fix, celebration timing, clips, confetti, text, and the 150px word-saved toast. Validate both mobile and desktop layouts plus typecheck/build.
