# Motivation & Engagement System

Three independent layers — SRS stays untouched. This plan adds the XP/motivation layer + the daily video credit loop, with hard rules preventing crossover into SRS or streak code.

## 1. Database (one migration)

Add motivation columns to `profiles` (additive, nullable, defaulted):

- `xp_total integer not null default 0`
- `xp_level integer not null default 1`
- `video_credit_date date` — last day the daily video was granted
- `video_credit_remaining integer not null default 1`
- `last_video_id uuid` — used to detect "video just finished" → reinforcement prompt

Add `xp_events` table (audit / debug — also future-proofs analytics):

```
id uuid pk default gen_random_uuid()
user_id uuid not null references auth.users(id) on delete cascade
action text not null   -- 'add_word' | 'review_card' | 'session_end' | 'video_watch' | 'reinforcement'
amount integer not null
meta jsonb
created_at timestamptz not null default now()
```

RLS: user can `select/insert` rows where `user_id = auth.uid()`. Service role full. Standard GRANTs.

## 2. XP engine — single source of truth

New file `src/lib/xp.ts`:

```ts
type XpAction = "add_word" | "review_card" | "session_end" | "video_watch" | "reinforcement";
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500];
export function levelFromXP(xp: number): { level: number; current: number; nextLevelXP: number }
export async function awardXP(action: XpAction, meta?: { correct?: boolean; cards?: number }): Promise<void>
```

`awardXP` rules (exactly as spec):
- `add_word` → +20
- `review_card` → +5, +5 more if `meta.correct`
- `video_watch` → +10
- `reinforcement` → +5
- `session_end` → +25 if `cards>=10`, else +10 if `cards>=5`, else 0

Behavior:
- Optimistic — pushes XP into an in-memory `XpContext` first, fires `supabase.rpc`/`update` in background. UI never waits.
- Logs every grant to `xp_events`.
- For guest users (no `user`), stores XP in `localStorage` under `linguascript.guestXP` and migrates on sign-in (added to `migrateGuestWords`).

## 3. XpContext provider

New `src/contexts/XpContext.tsx`:
- Loads `xp_total` from `profiles` on auth.
- Exposes `{ xp, level, nextLevelXP, award, recentGain }`.
- `recentGain` is a transient `{ amount, action, key }` consumed by the floating "+XP" toast.

Wrap `App.tsx` tree (`<AuthProvider> → <LanguageProvider> → <XpProvider> → <TourProvider>`).

## 4. UI feedback (dopamine layer)

- New `src/components/XpToast.tsx`: bottom-center floating `+20 XP` chip with spring animation (Framer Motion) when `recentGain` changes. Auto-dismisses 1.2s.
- Update `src/components/XPProgress.tsx` to read from `useXp()` by default (props remain optional override).
- Level-up: when `level` increases, fire a one-shot confetti + larger modal (`StreakCelebrationModal` styling, new copy "Level X reached!").

## 5. Wire actions

- `WordPopup.tsx` save handler → `award("add_word")`.
- `FlashcardReview.tsx`:
  - in `handleCorrect`/`handleIncorrect` call `award("review_card", { correct })`.
  - in `handleClose` / when `isComplete` first becomes true, call `award("session_end", { cards: correct + incorrect })`.
  - **No SRS code touched.** Award calls are fire-and-forget alongside existing `promoteDeckState`.
- `Watch.tsx`:
  - When the player reports completion (or 90% progress), call `award("video_watch")` once per video per day, and show the reinforcement prompt (see §6).

## 6. Daily video credit loop

New `src/lib/dailyVideo.ts`:
- `getDailyVideoStatus(userId)` — reads `profiles.video_credit_date/remaining`; if date < today, resets to 1.
- `consumeDailyVideo(userId, filmId)` — decrements, sets `last_video_id`.
- `isFeaturedVideo(film)` — picks today's featured film deterministically (hash of `date + user_id` modulo `films` count). Used for Browse highlighting.

UI:
- `Browse.tsx` → add a small "Today's featured video" badge on the chosen film (non-blocking; everything else still playable).
- `Watch.tsx` post-completion → bottom sheet "Great learning session — want to reinforce what you just learned?" with primary button → navigates to `/flashcards`; on arrival fires `award("reinforcement")`. Use a transient `sessionStorage` flag `reinforcement_pending` so it only triggers once and only via that button.

## 7. Hard separation guardrails

- `xp.ts` imports nothing from `vocab.ts`. Comment at top: `// MOTIVATION LAYER — must not import SRS modules.`
- `vocab.ts` / `FlashcardReview` promotion code unchanged; the only new lines are `void award(...)` calls.
- Streak code (`useStreakStatus`, `activity_log`) untouched.
- No XP value ever read by SRS or deck-derivation logic.

## 8. Files touched

New:
- `src/lib/xp.ts`
- `src/lib/dailyVideo.ts`
- `src/contexts/XpContext.tsx`
- `src/components/XpToast.tsx`

Edited:
- `src/App.tsx` (provider + toast)
- `src/components/XPProgress.tsx` (read from context)
- `src/components/WordPopup.tsx` (award add_word)
- `src/components/FlashcardReview.tsx` (award review_card + session_end)
- `src/pages/Watch.tsx` (video_watch + reinforcement prompt + consume credit)
- `src/pages/Browse.tsx` (featured badge)
- `src/pages/Flashcards.tsx` (consume reinforcement flag → award)
- `src/lib/guestWords.ts` (migrate guest XP)
- `src/integrations/supabase/types.ts` (regenerated by migration)

Migration:
- `profiles` add columns
- `xp_events` table + RLS + GRANTs

## 9. Expected behavior

- Saving a first word → instant `+20 XP` toast, progress bar animates.
- Each flashcard answer → `+5/+10 XP` toast.
- Finishing 10 cards → `+25 XP` session bonus toast.
- Watching today's featured video → `+10 XP` + reinforcement CTA → tapping it → `/flashcards` and `+5 XP`.
- Crossing a threshold → level-up celebration.
- SRS red→orange→green transitions behave exactly as today; no new latency, no new failure modes.
