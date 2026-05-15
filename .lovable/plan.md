# Interactive Onboarding Walkthrough

A forced, cursor-guided tour that runs on **real pages** (Watch, Browse, Flashcards, Profile) — not a mocked demo. Users cannot skip; each step requires the prescribed click before advancing.

## Architecture

A new global **`TourProvider`** (`src/contexts/TourContext.tsx`) wraps the app. It owns:
- current step id
- step config (target selector, tooltip copy, required interaction, next route)
- `advance()` / `setStep()` / `endTour()`

A new global **`TourOverlay`** component (mounted in `App.tsx` inside `LanguageProvider`) renders:
- animated fake cursor (framer-motion spring) that flies to the current target's bounding rect (resolved via `document.querySelector(selector)` + `getBoundingClientRect`, recomputed on resize/route change)
- tooltip near the target with copy
- a translucent "spotlight" that dims everything except the target
- click interception: only the target is clickable; everything else is blocked

Pages opt in by giving key elements stable `data-tour="..."` attributes. The overlay finds them by `[data-tour="..."]`.

The tour is triggered from the existing `/onboarding` page via a new "Enter the demo" button after the intro video, which sets `tour.start("watch-dual")` and navigates to `/watch/<training-video-id>`.

## Step sequence

| # | Route | Target (`data-tour`) | Tooltip | Required action |
|---|---|---|---|---|
| 1 | `/watch/:id` (training video) | `dual-subs-toggle` | "See two languages at once" | click toggle |
| 2 | `/watch/:id` | `subtitle-word` (any word in overlay) | "Click any word to learn it" | click a word |
| 3 | `/watch/:id` | `word-pronounce` (in WordPopup) | "Hear the word spoken" | click speaker |
| 4 | `/watch/:id` | `fullscreen-btn` | "Immerse yourself" | click fullscreen |
| — | auto-nav to `/browse` after 500ms | | | |
| 5 | `/browse` sidebar | `nav-flashcards` | "Your saved words live here" | click |
| 6 | `/flashcards` | `flashcard-body` | "Click the card to reveal translation" | click card |
| 7 | `/flashcards` | `flashcard-got-it` / `flashcard-again` | "Green = Got it · Red = Again" | click either |
| (repeat 6-7 once more) | | | | |
| 8 | back arrow → `/browse` | `nav-back` | — | auto-advance after route |
| 9 | `/browse` | `nav-calendar` | "Track your daily streaks" | click |
| 10 | back → `/browse` | `nav-back` | — | |
| 11 | `/browse` | `nav-settings` | "Set your languages" | click |
| 12 | `/profile` | `native-lang-select` | "Choose your native language" | select value |
| 13 | `/profile` | `target-lang-select` | "Choose what you're learning" | select value |
| 14 | back → `/browse` | `paste-youtube-input` | "Linguascript works with YouTube videos you already love. Paste any link." | input gets focus + value (auto-filled with `SoafcM3xqlc` URL by the tour) |
| 15 | `/watch/<new lesson>` | overlay finale | "You're ready. Happy learning." | dismiss |

Each `data-tour` already-present-or-not is verified during implementation; missing ones are added with no visual change.

## Onboarding intro video

Replace the current Onboarding "demo" embed with the Instagram intro video, played **inline** via Instagram's official `<blockquote class="instagram-media">` embed (loaded with `instagram.com/embed.js`). Below it: an "Enter the demo" CTA that starts the tour and routes to `/watch/<training-video-db-id>`.

The training video is `https://youtu.be/v7G2iPeiVVg`. We resolve its row in `films` by `youtube_id = 'v7G2iPeiVVg'` and route to `/watch/<row.id>`. If the row is missing, the tour falls back to opening the YT id directly.

## Required UI hooks (add `data-tour` attributes)

- `src/pages/Watch.tsx`: dual-subs toggle button, fullscreen button
- `src/components/SubtitleOverlay.tsx`: each word span
- `src/components/WordPopup.tsx`: pronunciation button
- `src/components/NavBar.tsx` (sidebar): flashcards link, calendar link, settings link, back arrow
- `src/pages/Profile.tsx`: native + target language selects
- `src/pages/Browse.tsx`: paste-YouTube input

## New files

- `src/contexts/TourContext.tsx` — provider + hook
- `src/components/TourOverlay.tsx` — cursor + tooltip + spotlight + click gate
- `src/lib/tourSteps.ts` — declarative step config

## Edited files

- `src/App.tsx` — wrap with TourProvider, render TourOverlay
- `src/pages/Onboarding.tsx` — Instagram inline embed + "Enter the demo" CTA → starts tour
- `src/pages/Watch.tsx`, `src/pages/Browse.tsx`, `src/pages/Profile.tsx`, `src/pages/Flashcards.tsx`, `src/components/NavBar.tsx`, `src/components/SubtitleOverlay.tsx`, `src/components/WordPopup.tsx` — add `data-tour` attributes; emit `tour.advance()` on the required interaction when that step is active

## Open questions

1. **Instagram intro URL** — what is the Instagram reel/post URL to embed? (Not provided; need it to render the inline player.)
2. **YouTube link demo (step 14)** — should the tour actually call the existing "create lesson from URL" pipeline (real fetch + DB insert + navigate to the new lesson), or just play a loading animation and stop? Real pipeline gives a true outcome; mock keeps the tour fast and avoids polluting the user's library.
3. **Replay** — should completing the tour persist a `tour_completed_at` flag on the profile so it never re-runs, with a "Replay tour" button in Settings? (Recommended yes.)
