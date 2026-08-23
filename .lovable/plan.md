# Mobile gap-fill fix, production branding, and progression proposal

## Scope

Fix only the two physical drag-position defects, replace the incorrect active desktop header mark with the official LinguaScript branding, complete favicon/Organization metadata, and deliver a research-only progression architecture. Preserve game rules, drop validation, scoring, auth, onboarding behavior, navigation, and database schema.

## 1. Fix the gap-fill drag clone

**Root cause found:** `GapFillChallenge` renders a `position: fixed` clone inside the video/challenge tree, which contains backdrop-filtered/transformed ancestors. Those ancestors can establish a containing block for the fixed child, while the code feeds it viewport-relative `clientX/clientY`; this mixes coordinate spaces and creates the initial offset, especially when scrolled/fullscreen. The clone also scales/rotates around its center, so a left/right-edge grab no longer stays under the same point. Pointer movement is already ref-based rather than React state-driven, but the additional `requestAnimationFrame` queue leaves the rendered clone one frame behind fast touch input.

- Render the floating `WordBlock` into `document.body` with a React portal so `position: fixed` and `clientX/clientY` share the viewport coordinate system regardless of scrolling, fullscreen layout, backdrop filters, or transformed ancestors.
- Store the exact pointer-to-source top-left offset from `getBoundingClientRect()` at pointer-down.
- Position the clone from `clientX/clientY - grabOffset` using `translate3d`, preserving left-, middle-, and right-edge grabs exactly.
- Remove decorative scale/rotation from the dragged clone because they alter the preserved grab point; keep the existing lifted shadow/visual state.
- Write the transform directly on each pointer move (no React state updates and no extra animation frame), retain Pointer Events and `touch-action: none`, and keep the existing center-based drop hit test and answer validation unchanged.
- Track the initiating pointer ID so unrelated pointers cannot move or end the active drag.

## 2. Use the official desktop branding

- In the active `/discover` desktop sidebar (`Browse.tsx`), replace the generated gradient square + `Languages` icon and gradient text with the existing shared `BrandMark` lockup.
- Keep the sidebar button, route, spacing, and navigation behavior intact.
- Adjust the shared lockup only if needed to ensure the official chameleon keeps its natural aspect ratio and the existing official wordmark displays **Lingua** in white and **Script** in LinguaScript green.
- Leave the already-correct mobile chameleon-only header behavior unchanged.

## 3. Complete favicon and Organization metadata

- Derive square, transparent 32×32, 192×192, and 512×512 favicon files plus `favicon.ico` from the existing official high-resolution green chameleon asset, cropping/padding rather than stretching it.
- Reference the PNG sizes, ICO fallback, and Apple touch icon from `index.html`; replace ambiguous old favicon metadata.
- Add homepage `Organization` JSON-LD with name `LinguaScript`, URL `https://linguascript.co.uk`, and a stable absolute URL to the 512×512 official logo.
- Keep `robots.txt` crawlable (it already allows all bots).

## 4. Verify the production-facing changes

- Use a touch-capable Playwright context against the live preview and test left, center, and right pointer-down positions, including after scrolling.
- Confirm the clone's touched local point remains aligned to the pointer on start and movement, with no React render-per-move path or CSS transition.
- Drag the correct answer into the existing gap and confirm completion; drag a wrong answer and confirm current rejection behavior; run a desktop pointer check.
- Inspect desktop and mobile screenshots for the official logo/wordmark and verify every favicon/JSON-LD URL responds and remains crawlable.

## 5. Deliver the progression architecture (research only)

Produce a detailed proposal without adding code or schema. It will include:

- Existing LinguaScript systems and reusable signals: three-deck vocabulary, CEFR seeding/core vocabulary, weighted token comprehension, per-video comprehension history, watch sessions, SRS, gap-fill/LinguaScript performance, daily goals/streaks, XP, film difficulty/category, catalogue rows, interests, and watch history.
- Credible open-source repositories/technical systems with links, lessons, and explicit “do not copy” guidance.
- A staged Content Difficulty Score using transcript-derived lexical coverage first, then sentence/subtitle density and speech rate, with slang/accent/audio features deferred until evidence quality supports them.
- A continuous Learner Ability Score with uncertainty and recency weighting rather than direct CEFR-number mapping.
- A learner-content match model producing Comfortable, Stretch, and Very Challenging bands.
- A soft-unlock system (guidance, not hard prohibition), milestone evidence requirements, struggle recovery, anti-gaming controls, and a restrained daily return loop.
- A future catalogue-metadata layer that never recommends unavailable/unusable content and treats transcript/subtitle access as an independent eligibility gate.
- Build-first/postpone sequencing and risks.

## Audit facts to report

- Active desktop header: `src/pages/Browse.tsx` sidebar.
- Incorrect current asset: no image asset; it is a generated `Languages` icon inside a gradient square, with `LinguaScript` rendered as gradient text.
- Replacement: shared `BrandMark` using `chameleon-green.png.asset.json` and `linguascript-wordmark.png.asset.json`.
- Shared language inventory currently contains 16 options: English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, Russian, Turkish, Dutch, Polish, Swedish.
- Desktop onboarding learning-language buttons currently expose only 7: French, Spanish, German, Italian, Portuguese, Japanese, English. Missing there: Chinese, Korean, Arabic, Hindi, Russian, Turkish, Dutch, Polish, Swedish.
