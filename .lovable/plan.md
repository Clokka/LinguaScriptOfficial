# Onboarding Flow + Settings Redesign

A Duolingo-inspired account → onboarding → app journey, plus a friendlier settings page.

## Routing changes

- `/story` "Enter the Demo" CTA → routes to `/auth?mode=signup&next=/onboarding` (new users) or `/onboarding` (already signed in).
- New route: `/onboarding` — gated; if user not signed in, redirect to `/auth`.
- After onboarding completes → `/browse`.

## Database

Add columns to `profiles`:
- `cef_level` text (A1, A2, B1, B2, C1, C2; nullable)
- `learning_goal` text (nullable)
- `onboarded` boolean default false
- `is_public` boolean default false

(Native + learning language already exist.)

Onboarding writes these. `Browse` checks `onboarded`; if false → redirect to `/onboarding`.

## /onboarding page (5 cards, swipeable)

Soft white bg with warm orange accents, Framer Motion card transitions, soft ding sound on key actions (small WebAudio beep, no asset).

```text
[ Step indicator dots ]
[ ← back ]    Card content    [ Continue → ]
```

**Card 0 — Setup (replaces "account creation" since auth is separate)**
- Native language select
- Target learning language select
- Current level: A1–C2 chips. If user picks "Below A1" → friendly message recommending Duolingo, blocks proceeding.

**Card 1 — Welcome + Goal**
- Headline "Welcome to the Lingua Universe 🌍"
- Stat line about written goals
- Textarea: "Write your language goal" → on submit saves to `profiles.learning_goal`, success tick animation + ding.

**Card 2 — How Linguascript Works**
- Lingua + Script explanation
- Mini interactive tutorial: a mock player screenshot with an animated cursor pointing to a "Dual Subtitles" button. User must click it to proceed.

**Card 3 — Catalogue & XP**
- Explains CEFR ratings on videos
- Explains Level XP (flashcards + mini boss test) and Immersion XP (watch time, streaks, reviews)

**Card 4 — Flashcards & SRS**
- Three decks: Short / Medium / Long term
- "Got it" promotes card + ding

**Card 5 — Learn Faster**
- Shadowing + Word click feature explanation
- Final CTA: "Start learning" → marks `onboarded=true`, navigates `/browse`.

## Settings page redesign

Refactor `SettingsPanel` (and/or `Profile` page) to:
- White/cream background, warm orange accents (uses existing `--accent` orange tokens)
- Sectioned layout: Profile, Languages, Learning, Privacy
- Add "Public account" toggle (writes `profiles.is_public`)
- Add disabled "Leaderboard — Coming Soon" row

## Sound

Tiny `playDing()` util using `AudioContext` (no asset upload required).

## Files

- New: `src/pages/Onboarding.tsx`, `src/lib/sound.ts`
- Edit: `src/App.tsx` (route), `src/pages/Story.tsx` (CTA target), `src/pages/Auth.tsx` (respect `?next=`), `src/pages/Browse.tsx` (redirect if not onboarded), `src/components/SettingsPanel.tsx` (redesign), `src/integrations/supabase/types.ts` auto-updated by migration.
- Migration: add 4 profile columns.

## Out of scope (not in this pass)
- Real "mini boss fight" test logic
- Leaderboard backend
- Recording onboarding completion analytics
