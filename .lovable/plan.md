# Leaderboard Privacy + Friend Messaging

## Part 1 — Hide emails on the global leaderboard (privacy fix)

**Problem:** `get_global_leaderboard` returns `display_name`, which for users who signed up without setting a name is their raw email. Showing real emails to strangers is a privacy breach (especially since some users haven't even completed onboarding / consented to being public).

**Fix:**
1. Update `get_global_leaderboard` to never return raw emails. Logic:
   - If `username` is set → show `@username`.
   - Else if `display_name` exists AND doesn't look like an email → show it.
   - Else → return a stable auto-generated handle like `Learner #A4F2` (derived from a hash of `user_id`, so it stays consistent across page loads).
2. Apply the same rule to `get_friends_leaderboard` for non-self / non-accepted-friend rows. Friends you've explicitly added can still see your real display name.
3. Frontend (`Friends.tsx`): drop the email-looking fallback in `LeaderboardRow` — trust the RPC.

This is fully server-side so emails never reach the browser.

## Part 2 — "Add friend" + "Send message" from the global leaderboard

Each global row gets two buttons:
- **Add** → existing `add_friend_by_code` flow, but by `user_id` (new RPC `add_friend_by_user_id`).
- **Message** → opens a small dialog to type a short note (max 500 chars).

## Part 3 — Messaging system

**New table `friend_messages`:**
- `id`, `sender_id`, `recipient_id`, `body` (text, ≤500), `created_at`, `read_at`.
- RLS: sender or recipient can `SELECT`; only authenticated users can `INSERT` where `sender_id = auth.uid()`; only recipient can `UPDATE` (to mark read).
- Rate-limit via trigger: max 5 messages per sender per recipient per 24h, max 30 messages/day total per sender. Prevents spam abuse.

**Edge Function `send-friend-message`:**
1. Auth-checks the caller.
2. Inserts the message row (rate-limit enforced by trigger).
3. Looks up recipient's email via `auth.users` using service role.
4. Invokes `send-transactional-email` with template `friend-message-notification`, idempotency key `msg-<message_id>`.
5. Returns success/failure to client.

**Email template `friend-message-notification.tsx`:**
- From: `hello@linguascript.xyz` (the verified LinguaScript sender).
- Subject: `{senderName} sent you a message on LinguaScript`.
- Body: sender's display name/username, the message body, CTA button → `https://linguascript.xyz/friends?tab=inbox`.
- Unsubscribe footer auto-appended by the system.

Note on the `rowan@` vs `hello@` ask: emails will be sent from `hello@linguascript.xyz` (or whichever address is verified on the existing email domain). A personal `rowan@` From address would need that mailbox set up separately on the domain — happy to add it as a follow-up once you confirm.

## Part 4 — Inbox UI

New `Inbox` tab in `/friends`:
- Lists messages received, newest first, with unread badge.
- Clicking marks read.
- Reply box (also goes through `send-friend-message`).

Sidebar `Friends` link gets an unread-count dot.

## Technical details

```text
DB:
  friend_messages (id, sender_id, recipient_id, body, created_at, read_at)
  RPC: add_friend_by_user_id(_target uuid)
  RPC: get_unread_message_count() returns int
  Trigger: enforce_message_rate_limit BEFORE INSERT
  Updated RPCs: get_global_leaderboard, get_friends_leaderboard
                → sanitize display_name, never return raw email

Edge functions:
  send-friend-message  (new)
  send-transactional-email  (already exists, just register new template)

Templates:
  supabase/functions/_shared/transactional-email-templates/friend-message-notification.tsx
  Register in registry.ts

Frontend:
  src/pages/Friends.tsx
    - new "Inbox" tab
    - Add/Message buttons on each LeaderboardRow
    - MessageDialog component
    - drop email fallback
  src/lib/displayName.ts  (helper: stable "Learner #XXXX" from uuid, in case anywhere else needs it)
```

## What this does NOT do (out of scope until you confirm)
- Real-time message delivery (websockets/realtime) — initial version polls on tab open.
- Image/file attachments — text only.
- Blocking / reporting users — can add later.
- Custom `rowan@linguascript.xyz` From address — needs mailbox setup.

Approve and I'll build it.
