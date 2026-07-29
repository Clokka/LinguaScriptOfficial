# Testing LinguaScripts Feature (Local)

## Prerequisites

1. **Branch:** Check out `claude/linguascript-extension-plan-sqwsyl`
2. **Dependencies:** Run `npm install`
3. **Supabase:** Updated schema (see `docs/SUPABASE_SCHEMA_UPDATES.md`)

## Quick Setup (5 minutes)

### Step 1: Apply Schema Changes
Go to your Supabase dashboard → SQL Editor and run:

```sql
-- Add columns to saved_words
ALTER TABLE saved_words ADD COLUMN IF NOT EXISTS (
  context_phrase TEXT,
  context_translation TEXT,
  appearance_count INT DEFAULT 0,
  next_review_at TIMESTAMP,
  last_reviewed_at TIMESTAMP,
  last_correct_at TIMESTAMP
);

-- Create linguascript_reviews table
CREATE TABLE IF NOT EXISTS linguascript_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES saved_words(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('gap-fill', 'mcq', 'speaking')),
  timestamp TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS linguascript_reviews_user_idx 
ON linguascript_reviews(user_id, created_at DESC);
```

### Step 2: Create Test Data
Run this SQL to add 3 test words with context:

```sql
INSERT INTO saved_words (
  user_id, 
  word, 
  translation, 
  language, 
  context_phrase, 
  context_translation,
  appearance_count,
  pronunciation,
  ipa
) 
VALUES 
(
  'YOUR_USER_ID_HERE',  -- Replace with your auth user ID
  'café',
  'coffee',
  'fr',
  'Je vais au café ce matin',
  'I''m going to the cafe this morning',
  0,
  'kah-fay',
  '/kɑːˈfeɪ/'
),
(
  'YOUR_USER_ID_HERE',
  'merci',
  'thank you',
  'fr',
  'Merci beaucoup pour votre aide',
  'Thank you very much for your help',
  0,
  'mer-see',
  '/meɪrˈsi/'
),
(
  'YOUR_USER_ID_HERE',
  'bonjour',
  'hello',
  'fr',
  'Bonjour, comment allez-vous?',
  'Hello, how are you?',
  0,
  'bon-zhoor',
  '/ˌbɒnˈʒuər/'
);
```

**Note:** Find your `user_id` in Supabase Auth → Users tab

### Step 3: Start Dev Server
```bash
npm run dev
```

### Step 4: Test the Flow

1. **Navigate to home:** Go to `http://localhost:5173/discover`
2. **Should see alert:** "🔥 3 LinguaScripts Ready for Review"
3. **Click START:** Opens multi-exercise session
4. **Complete 3 exercises:** Gap-Fill, MCQ, Gap-Fill (rotates)
5. **See session summary:** "Session Complete!" with stats
6. **Refresh page:** Now shows "✅ All LinguaScripts Complete!"

## Expected Behavior

### Initial State (appearance_count < 3)
```
Home Page Shows:
┌────────────────────────────────────────┐
│  🔥 3 LinguaScripts Ready for Review   │
│  Review the words you learned before   │
│  they fade from memory                 │
│  [START DAILY LINGUASCRIPTS]           │
└────────────────────────────────────────┘
```

### After Starting Session
```
Exercise 1: Gap-Fill "bonjour"
├─ Context shown: "Bonjour, comment allez-vous?"
├─ Fill in: ______
├─ [Check Answer] → shows "✓ Correct!" or "✗ Not quite right"
└─ [Try Again] / [Next]

(Then exercise 2, 3, etc)
```

### After Completion
```
Session Complete!
├─ 3 Words Reviewed
├─ 66% Accuracy  
├─ +45 XP
└─ [Now Go Watch More Content]
     [View Reinforcement Reviews]
```

### Post-Session (Refresh)
```
✅ All LinguaScripts Complete!
You've reviewed 3 words today
💡 Pro tip: Click words in subtitles to add to LinguaScripts
[Continue Watching] [Discover New Content]
```

## Debugging

### Check Database
```sql
-- See test words
SELECT id, word, appearance_count FROM saved_words 
WHERE user_id = 'YOUR_USER_ID' 
LIMIT 5;

-- See reviews logged
SELECT * FROM linguascript_reviews 
WHERE user_id = 'YOUR_USER_ID' 
ORDER BY created_at DESC 
LIMIT 10;
```

### Check Browser Console
- Look for error messages in `console.log`
- `[useLinguaScriptStatus]` messages show hook operations
- `[LinguaScriptExercise]` messages show exercise logging

### Known Issues
1. **No alert showing?** 
   - Check user_id is correct in test data
   - Verify schema columns exist: `DESCRIBE saved_words`
   - Browser cache: hard refresh (Cmd+Shift+R)

2. **Exercises not loading?**
   - Check appearance_count < 3 in test data
   - Verify saved_words IDs exist
   - Check browser console for errors

3. **Reviews not logging?**
   - linguascript_reviews table may not exist yet
   - This is expected - feature degrades gracefully
   - Run the CREATE TABLE statement above

## Test Scenarios

### Scenario 1: First Time (MVP Happy Path)
- [ ] Home shows 3 pending LinguaScripts
- [ ] Session starts with exercise 1
- [ ] Each exercise shows context phrase
- [ ] Answer exercises correctly/incorrectly
- [ ] Session summary shows stats
- [ ] Refresh home shows "Complete"

### Scenario 2: Multiple Sessions
- [ ] Add more test words (repeat SQL insert with different words)
- [ ] Home shows new count
- [ ] Run multiple sessions
- [ ] appearance_count increments (check in DB)

### Scenario 3: Mixed Accuracy
- [ ] Some exercises correct, some incorrect
- [ ] Both logged in linguascript_reviews
- [ ] Accuracy % calculated correctly
- [ ] XP awarded for correct answers

## Performance Notes

- First load may take 2-3 seconds (status check)
- Session flow should be smooth (exercises load instantly)
- Confetti animation on final correct answer

## Next Steps After Testing

1. **Verify everything works** ✓
2. **Merge to main** (create PR)
3. **Deploy to staging** (verify with real data)
4. **Rollout to users** (monitor logs)
5. **Iterate on algorithm** (once data collected)

## Support

If something breaks:
1. Check error messages in console
2. Verify schema columns with `DESCRIBE saved_words`
3. Look at commit history: `git log --oneline -10`
4. Revert if needed: `git reset --hard origin/main`
