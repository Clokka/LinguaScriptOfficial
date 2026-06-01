## Onboarding Flow Improvements & UX Refinements

This is a large, multi-area overhaul of the onboarding experience. Before I start coding, here's the plan broken down into shippable phases so we can confirm scope.

---

### Phase 1 — Frictionless Demo Start (no ads, smoother tooltips)

1. **Suppress ads during onboarding**
   - Add a `tourActive` / `onboardingActive` flag on `TourContext`.
   - In `AdLoader` consumers (Watch / Story / demo player), skip the ad entirely when tour is active — start video immediately.
   - Disable any mid-roll/house-ad triggers while tour is active.

2. **Re-sequence the Watch-page tour steps** so they don't collide with loaders:
   - `enter-demo` → video plays immediately (no ad)
   - `watch-dual` tooltip
   - `watch-word` (click word) → translation popup
   - **NEW** `watch-save` step → highlight "Save to flashcards" button with copy: *"Save useful words directly into your personal flashcard deck for long-term retention."*
   - `watch-pron`
   - `watch-fullscreen` — fix reliability (see below)

3. **Fullscreen reliability fix**
   - In `TourOverlay`, the fullscreen step should programmatically call `requestFullscreen()` on the player container (not rely on synthetic click).
   - Wait for `fullscreenchange` event before advancing.

---

### Phase 2 — Post-Video Continuation

4. **Exit-video step**: when user exits/finishes demo, show tooltip over the top-left back button: *"Head back to your learning dashboard."* Cursor + spotlight on `[data-tour="page-back"]`.

5. **Flashcard walkthrough** (extend `tourSteps.ts`):
   - Hover Flashcards nav → tooltip about personal learning system.
   - Open a flashcard.
   - Click card → reveal translation tooltip.
   - Pronunciation tooltip with shadowing stat (2–3× retention).
   - Let user review a few cards before continuing (advance on N reviews or Skip button).

---

### Phase 3 — Calendar / Streak / Spaced Repetition Education

6. **Calendar page tour**
   - "Today's Mission" panel showing dynamic targets from `profiles.daily_word_goal` & `daily_video_goal` (already in DB). Compute remaining = goal − today's `activity_log` values.
   - Tooltips for: Current Streak, Total Words, Avg/Day, Projected Annual Growth, Watch Time, Retention.
   - Streak explainer tooltip.

7. **Spaced Repetition modal** on Calendar with YouTube embed `-uMMRjrzPmE`. Buttons: *Watch Video / Skip / I Already Understand*.

8. **Memory Stage education** — explain Must Review / Reinforcing / Acquired stages (already exist as `MemoryStageCard`).

---

### Phase 4 — Account Creation & Personalisation

9. **Account creation at end of onboarding**
   - Modal/page with Google + Email + Student section (school name + school email).
   - Note: *"Ask your teacher for your LinguaScript access password if your school participates."*
   - On signup, migrate anonymous onboarding state (goals, native/learning lang) into the new profile — already partially supported.

10. **Interests / Recommendation seed**
    - Add `interests text[]` column to `profiles`.
    - After signup, route to Settings with tooltip + free-text "What are you interested in?" with suggested chips (Football, History, Anime, Business, Travel, Tech, Gaming, Politics, Philosophy).
    - Feed into recommendation queries (Browse).

---

### Technical Notes

- **TourContext** gains: `onboardingActive`, multi-page step list, helpers `markComplete(stepId)`, `awaitFullscreen()`.
- **AdLoader** consumers read `useTour().onboardingActive` and skip.
- **DB migration**: add `profiles.interests text[]` default `'{}'`.
- **No business-logic changes** to flashcard SRS / activity logging — just UI tour layers on top.

---

### Suggested rollout

Because this is large, I recommend shipping in 2 PRs:

- **PR 1 (this turn):** Phase 1 + Phase 2 — kills ads in onboarding, fixes fullscreen, adds save-to-flashcard step, adds post-video → flashcard walkthrough.
- **PR 2 (next turn):** Phase 3 + Phase 4 — calendar/streak tour, spaced-rep modal, account creation gate, interests field + migration.

**Reply "go" to ship PR 1 now**, or tell me to do everything in one pass (will be a much larger diff and slower to review).
