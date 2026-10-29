# LinguaScripts Setup Guide

This guide explains how to set up the LinguaScripts system (Phase 0 of the SRS implementation).

## What Gets Created

1. **`linguascripts` table** - Stores AI-generated sentences with gap-fill and multiple-choice variants
2. **RPC functions**:
   - `get_daily_linguascripts()` - Fetches today's exercises
   - `schedule_linguascript_to_srs()` - Links completed exercises to saved_words
   - `create_daily_linguascript()` - Creates new exercises

## Setup Steps

### Step 1: Run the Migration

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Create a new query
5. Copy the contents of `supabase/migrations/create_linguascripts_system.sql`
6. Run it

**Expected output**: No errors, tables and functions created.

### Step 2: Seed Test Data

1. In the SQL Editor, create another new query
2. Copy the contents of `supabase/migrations/seed_linguascripts.sql`
3. Run it

**Expected output**: "Successfully seeded 5 LinguaScripts for user [USER_ID]"

If you get a warning that no users exist:
- Go back to the app
- Sign up for an account
- Come back and run the seed script again

### Step 3: Update TypeScript Types

The types have already been updated in `src/integrations/supabase/types.ts` (see the `LinguaScript` interface in `src/lib/linguascripts.ts`).

If you need to regenerate types from Supabase:
```bash
# In the project root
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts
```

## Testing the Page

Once the migration is complete:

1. Start the dev server: `npm run dev`
2. Navigate to `/linguascripts`
3. You should see:
   - "Today's Mission" card showing pending exercises
   - 5 sample exercises (4 pending, 1 completed)
   - Progress bar showing 1/5 completed
   - Options to try Gap-Fill or Multiple Choice

## What Each Sample Exercise Tests

1. **"remplir"** (fill) - Everyday context
2. **"commander"** (order) - Dining/restaurant context
3. **"arriver"** (arrive) - Travel context
4. **"apprendre"** (learn) - Learning context (pre-completed to show progress)
5. **"jouer"** (play) - Sports context

## Troubleshooting

### "No exercises for today yet"
- Check that the migration ran successfully (run `SELECT COUNT(*) FROM linguascripts;` in SQL Editor)
- Ensure you ran the seed script
- Make sure you're logged in

### RPC function error
- Re-run the migration SQL
- Check that the function name matches: `get_daily_linguascripts`

### Table doesn't exist error
- Run the migration again
- Check SQL Editor for any errors

## Next Steps

Once this is working:
1. The LinguaScriptExercise component can evaluate gap-fill and MCQ answers
2. Completed exercises will auto-schedule words to saved_words with SRS timing
3. Phase 1 (SRS engine) can begin

## Database Schema

```sql
-- Key fields in linguascripts table:
- id (primary key)
- user_id (FK to auth.users)
- target_word (the word being learned)
- sentence (full sentence with the word)
- translation (English translation)
- gap_position (where the blank is)
- gap_options (correct answer + 3 distractors)
- mcq_options (multiple choice variants)
- status (pending/started/completed/skipped)
- correct (boolean, set when completed)
- scheduled_to_srs (true if word was saved to saved_words)
```

## Production Considerations

- These RPCs use `SECURITY DEFINER` to allow users to only see their own data
- Indexes are created for fast queries on user_id and created_at
- The seed data is test data and should be deleted before production launch
