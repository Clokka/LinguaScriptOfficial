# Word-saved chameleon: clipping and odd shading

## Audit (from screenshots 1–2)
- Only the chameleon's lower body and legs show; the top of the model is cut off at the edge of its 150px box. The size looks right now, but the framing is wrong.
- Likely causes:
  1. Its size is worked out from the model's pose *before* the Bounce animation plays. Bounce lifts the body upward, so the lifted head and back leave the camera's view.
  2. The elastic pop scales it up to about 110% while it springs in, which pushes it past the frame for a moment.
  3. The dark green-to-black shading happens because light only comes from the top (a hemisphere light with a dark purple floor colour), so the underside and back end up almost black on the dark page.
- The level-up celebration uses a lower 1.15 fit, which is why it isn't clipped.

## Fix
1. Size the model against its tallest point across the whole Bounce/Spin clip, not just its resting pose, then centre it on that range.
2. Give the word-saved chameleon a little margin (fit about 1.2) while keeping the 150px box and 150px canvas unchanged.
3. Soften the lighting: a neutral floor colour for the hemisphere light, plus a gentle front fill light so it looks bright green instead of murky.
4. Move the toast up a little so the chameleon never overlaps the "best experience" banner on phones.
5. Check it at 384×626 and on desktop: the whole chameleon stays visible through the pop, bounce and exit.

## Fix prompt
In `src/components/pets/PetCelebration.tsx`, stop the word-saved pet from being clipped. Compute the fitting box by sampling the loop clip (and intro clip) over its duration with a temporary AnimationMixer, taking the union Box3, and scale/centre against that. Lower the word-saved fit to ~1.2 (box and canvas stay at 150). Change the hemisphere ground colour to a neutral light grey and add a soft front DirectionalLight fill. Keep level-up sizes, timings, clips and confetti the same. Check with Playwright screenshots at 384×626 and 1280×800.
