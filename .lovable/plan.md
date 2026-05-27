# LinguaScript Growth OS Upgrade

A motivation-first overhaul of onboarding, streaks, calendar, and progress. Designed around spaced repetition memory stages and daily compounding input.

## 1. Database changes (one migration)

Add fields to support goals, streak gating, and SRS memory stage tracking.

```text
profiles
  + daily_video_goal        int   default 1    (1|2|3)
  + daily_word_goal         int   default 10   (derived from video goal)
  + streak_count            int   default 0
  + last_streak_date        date  nullable
  + show_daily_briefing     bool  default true (settings escape hatch, hidden in UI for now)

activity_log  (existing)
  + words_reviewed          int   default 0
  + goal_met                bool  default false

saved_words  (existing)
  - review_count already exists -> drives memory stage:
      0-1   = RED   (short-term, "Must Review")
      2-3   = AMBER (medium-term)
      4+    = GREEN (long-term)
```

No new tables — we reuse `saved_words.review_count` and `activity_log` to keep the architecture lean.

## 2. Persistent Daily Briefing (replaces one-shot onboarding)

- New component `DailyBriefing` shown as a modal on every login if not yet completed today.
- Shortened 3-step flow for returning users:
  1. **Welcome back** — streak status + yesterday's recap
  2. **Today's mission** — daily video + word goal restated with progress bar
  3. **Go learn** — CTA into `/browse`
- First-time users still see the existing full onboarding (`/onboarding`), with the new **Daily Goal** step added.
- Tracked via `localStorage` key `briefing:<userId>:<YYYY-MM-DD>` + `profiles.show_daily_briefing` master switch.

## 3. Daily Goal selector

New component `DailyGoalPicker` used in onboarding **and** the briefing.

Three glass cards (1 / 2 / 3 videos per day) showing:
- Estimated new words/day
- Projected yearly vocab
- Fluency milestone tagline
- Motivational subtitle: *"Language growth compounds through repetition and comprehensible input."*

Saves to `profiles.daily_video_goal` and derives `daily_word_goal` (10 / 20 / 40).

## 4. Streak gating + Lottie ignition

New hook `useStreakStatus(userId)`:
- Reads today's `activity_log` row
- Returns `{ wordsReviewed, minutesWatched, wordsGoalMet, watchGoalMet, streakActive, streakCount }`
- Streak ignites only when **both** goals met → writes `goal_met = true` and bumps `profiles.streak_count` (with yesterday-continuity check).

`StreakBadge` rewrite:
- **Inactive state**: greyscale flame + CTA *"Review X more words and watch Y more minutes to earn today's streak."*
- **Active state**: plays the uploaded `Check-In Stream.lottie` once on ignition, then loops subtly.

Lottie wiring:
- Copy `Check-In Stream.lottie` → `src/assets/check-in-stream.lottie`
- Install `@lottiefiles/dotlottie-react` (lightweight, web-perf friendly)
- Wrapper `<StreakLottie active loop />` used in calendar, briefing success, and badge.

## 5. Calendar + Memory dashboard

Rebuild `src/pages/Profile.tsx` calendar tab (or a new `/progress` route reachable from sidebar) into a **Learning Analytics Dashboard**.

Sections:

**A. Top stat grid (glass cards, animated counters)**
- Current Streak (with Lottie)
- Total Words Learned
- Avg Words/Day (last 30d)
- Projected Vocab in 1 Year
- Watch Time This Week
- Retention Strength %

**B. Reviewed Words by Memory Stage**
Three stacked bars / pill cards:
- 🔴 **Short-Term (Must Review)** — `review_count ≤ 1`
- 🟠 **Medium-Term** — `review_count 2–3`
- 🟢 **Long-Term** — `review_count ≥ 4`

Each shows count + percentage + brief explainer.

**C. Activity Calendar**
Existing month grid, recolored by `goal_met`:
- Green dot = streak day
- Amber = activity but goal not met
- Empty = no activity

## 6. Analytics math (client-side, no extra tables)

`src/lib/progressStats.ts` — pure functions:
- `memoryStage(reviewCount) → 'short'|'medium'|'long'`
- `retentionStrength(words)` → % of words in medium+long
- `avgWordsPerDay(activity, days=30)`
- `projectedYearlyVocab(avgPerDay)`
- `watchTimeThisWeek(activity)`

## 7. UX details

- Mobile-first; all cards stack at `<md`
- Framer Motion for counter rolls + card entrances
- No new routes required — Briefing is a modal in `App.tsx`; dashboard lives inside `/profile`
- Existing onboarding French-only lock, school field, and Auth changes are preserved

## 8. Files

**New**
- `src/assets/check-in-stream.lottie`
- `src/components/StreakLottie.tsx`
- `src/components/DailyBriefing.tsx`
- `src/components/DailyGoalPicker.tsx`
- `src/components/MemoryStageCard.tsx`
- `src/components/ProgressDashboard.tsx`
- `src/hooks/useStreakStatus.ts`
- `src/hooks/useDailyBriefing.ts`
- `src/lib/progressStats.ts`

**Edited**
- `supabase/migrations/<new>.sql` — profile + activity columns
- `src/pages/Onboarding.tsx` — insert goal step
- `src/pages/Profile.tsx` — embed ProgressDashboard
- `src/components/StreakBadge.tsx` — gated state + Lottie
- `src/App.tsx` — mount DailyBriefing modal
- `package.json` — add `@lottiefiles/dotlottie-react`

## 9. Out of scope (this turn)
- Settings toggle to permanently disable briefing (column is added, UI deferred per brief)
- Server-side cron for streak resets (handled lazily on next login)
- Pre-roll ads, XP overhaul

Ready to implement on approval.