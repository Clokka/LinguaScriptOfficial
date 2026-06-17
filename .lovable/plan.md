# LinguaScript Email Retention + Privacy Plan

Goal: bring users back to the **Watch → Save → Review → Return** loop. Never spam. Hard cap **1–3 emails/week** for active users. All emails respect the existing suppression list + per-user preferences + leaderboard privacy panel.

---

## Part 1 — Onboarding Card 1 updates (existing card)

- Add goal input field (free text, saved to `profiles.learning_goal`).
- Add "Saved ✓" and "Added to your calendar ✨" confirmation chips.
- Add "Appear on the public LinguaScript leaderboard" checkbox → `profiles.show_on_global_leaderboard` (already exists, default `true`).
- When unchecked, render a sub-panel:
  - Hide profile from: Public leaderboards / XP rankings / Friend discovery.
  - "Existing friends can still see your profile unless blocked."
- Behaviour: when `show_on_global_leaderboard = false`, user is excluded from `get_global_leaderboard` (already enforced) AND from friend search/discovery results.

## Part 2 — Privacy schema additions

New columns on `profiles`:
- `learning_goal text`
- `discoverable_by_search bool default true` (controls friend-search visibility, falls back to `show_on_global_leaderboard` when false)
- `email_prefs jsonb default '{"review_reminders":true,"streak_rescue":true,"friend_requests":true,"weekly_report":true,"monthly_report":true,"rank_overtaken":false}'`
- `last_review_email_at timestamptz`
- `last_streak_rescue_email_at timestamptz`
- `last_weekly_email_at timestamptz`
- `last_monthly_email_at timestamptz`
- `review_emails_this_week int default 0` + `review_emails_week_start date`

RPC `update_email_prefs(_prefs jsonb)` for the settings UI.

## Part 3 — Email templates (React Email, in `_shared/transactional-email-templates/`)

1. `review-reminder` — "You have N cards ready for review" / "Your {language} words are waiting". CTA → `/flashcards`.
2. `streak-rescue` — "Don't lose your {N}-day streak". CTA → `/browse`.
3. `friend-request-received` — sender name + Accept CTA → `/friends`.
4. `friend-request-accepted` — "{name} accepted your friend request". CTA → `/friends`.
5. `weekly-progress` — XP gained, cards reviewed, words learned, streak, leaderboard rank, learning minutes.
6. `monthly-recap` — total minutes, words saved/mastered, XP growth, longest streak, top achievements.
7. (optional, off by default) `rank-overtaken` — "{name} just passed you on the leaderboard". Only sent if user opts in.

All templates branded (deep indigo / orange / glass) and sent from `hello@linguascript.xyz` (already verified via `rowan.linguascript.xyz` sender domain).

## Part 4 — Sending logic & frequency caps

Single new edge function: **`dispatch-retention-emails`** (runs every 15 min via pg_cron). It scans candidates and enqueues at most one of each type per user per run via existing `send-transactional-email`.

Per-user gating rules (enforced in SQL):

| Email | Trigger | Cap |
|---|---|---|
| Review reminder | ≥5 cards due in `saved_words` AND last activity >24h ago | 1 per 48h, max 3/week |
| Streak rescue | streak ≥3 AND 6–12h before expiry AND not already sent this streak | 1 per streak |
| Friend request received | new `friendships` row, status=pending | Immediate, dedup via idempotency key |
| Friend request accepted | `friendships` status → accepted | Immediate, idempotency key |
| Weekly progress | Sunday 17:00 user-local (UTC fallback) | 1/week, only if user had any activity that week |
| Monthly recap | 1st of month | 1/month, only if any activity |

Hard global cap: **max 3 non-transactional emails/week** per user. Friend request emails bypass cap (truly transactional). Suppression list and `email_prefs` always checked first.

Friend events fire from the existing friendship RPCs (small change to `add_friend_by_user_id` / `accept_friend_request` to `pg_notify` or directly invoke the function via `net.http_post`). Cleanest path: a SQL trigger on `friendships` calling `net.http_post` to `dispatch-retention-emails` with `{type:'friend_request', row_id}`.

## Part 5 — Settings UI

New "Email preferences" section in `/profile`:
- Toggles for each category (mapped to `email_prefs`).
- Link: "Unsubscribe from all" → calls existing `handle-email-unsubscribe`.
- Privacy section: leaderboard visibility + friend-discovery toggle.

## Part 6 — What this does NOT do
- No realtime ranking emails (anti-spam rule).
- No daily digests.
- No marketing/announcement emails.
- No localized send times beyond UTC fallback in v1.

## Technical summary

```text
DB migration:
  ALTER TABLE profiles ADD COLUMN ... (prefs + throttle columns + learning_goal + discoverable_by_search)
  RPC update_email_prefs(jsonb)
  RPC get_review_reminder_candidates() — users needing review email now
  RPC get_streak_rescue_candidates()
  RPC get_weekly_report_candidates()
  RPC get_monthly_report_candidates()
  Trigger on friendships → net.http_post to dispatch-retention-emails

Edge functions:
  dispatch-retention-emails  (new, scheduled every 15 min)
  send-transactional-email   (existing — just register new templates)

Templates (new, all in _shared/transactional-email-templates/):
  review-reminder.tsx
  streak-rescue.tsx
  friend-request-received.tsx
  friend-request-accepted.tsx
  weekly-progress.tsx
  monthly-recap.tsx

Cron:
  SELECT cron.schedule('retention-dispatch', '*/15 * * * *', $$ net.http_post(...) $$);

Frontend:
  src/pages/Onboarding.tsx — goal input + privacy sub-panel
  src/pages/Profile.tsx — Email preferences section
  src/pages/Friends.tsx — respect discoverable_by_search in global tab
```

Sender domain `rowan.linguascript.xyz` is already verified, From address `hello@linguascript.xyz` works today — nothing to set up DNS-wise.

Approve and I'll build it in one pass.