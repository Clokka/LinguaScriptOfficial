# Fix: "0 LinguaScripts Ready" on /discover

## What's actually broken

The hypothesis in the brief (subscription not firing) is only half the story. There are three concrete faults, and the first one alone guarantees a zero count:

1. **The query references columns that do not exist.**
   Both `useLinguaScriptStatus.ts` and `LinguaScripts.tsx` filter on `scheduled_for` and sort by `word_state`. The `linguascripts` table has neither column. The query errors out, `linguascripts` comes back `null`, and the count is `0` — every time, on every page. This is why the count never moves no matter how many words you save.

2. **Realtime is not enabled on the table.**
   `linguascripts` is not in the realtime publication, so the `postgres_changes` subscription is a no-op. Even with a working query, the count would only update on a page reload.

3. **`linguascripts` has row-level security switched off.**
   259 rows of user exercise data are currently readable by anyone with the public API key. This needs fixing in the same pass.

Secondary: the count query has `.limit(10)`, so even once fixed it would cap at 10 and understate reality.

## The fix

### Database (one migration)
- Add `scheduled_for timestamptz not null default now()` and `word_state text not null default 'red'` to `linguascripts`.
- Backfill existing rows: `scheduled_for = created_at`, and `word_state` from the linked `saved_words.state` where a link exists.
- Index on `(user_id, language, scheduled_for)` filtered to incomplete rows.
- Enable RLS, add GRANTs, and add owner-only policies (select/insert/update/delete where `user_id = auth.uid()`).
- Add `linguascripts` and `saved_words` to the realtime publication with `REPLICA IDENTITY FULL`.

### Hook rewrite (`useLinguaScriptStatus.ts`)
Rebuild it simple, as the brief allows:
- One exact `count` query for due exercises (`scheduled_for <= now`, `completed_at is null`) — no 10-row cap.
- One small query for the first 10 due IDs, for the session.
- Surface query errors instead of silently degrading to zero.
- Keep the realtime subscription (now that it will actually fire), and add a refetch on window focus and on tab return so the count is correct even if a realtime frame is missed.

### Page alignment (`LinguaScripts.tsx`)
Use the same due definition as the hook so `/discover` and `/linguascripts` never disagree.

## Success criteria
- Save a word while watching → `/discover` shows a non-zero "LinguaScripts Ready" count without a reload.
- The number on `/discover` equals the due number on `/linguascripts`.
- `linguascripts` rows are only visible to their owner.

## Not in this change
SRS scheduling (Phase 4). Everything stays scheduled for "now"; the `scheduled_for` column is added so intervals can be layered on later without another schema change.
