# Supabase Schema Updates for LinguaScript v2

This document outlines the database schema changes needed to support the new LinguaScript home state machine and multi-exercise session flow.

## Columns to Add to `saved_words` Table

```sql
-- Add to existing saved_words table
ALTER TABLE saved_words ADD COLUMN IF NOT EXISTS (
  context_phrase TEXT,                    -- Full sentence from content: "Bonjour, comment allez-vous?"
  context_translation TEXT,               -- Translation of phrase: "Hello, how are you?"
  appearance_count INT DEFAULT 0,         -- How many times shown in LinguaScripts
  next_review_at TIMESTAMP,               -- When user should review this word (used for SRS)
  last_reviewed_at TIMESTAMP,             -- Last time user reviewed it
  last_correct_at TIMESTAMP               -- Last time user answered correctly
);

-- Add index for home page query (finding LinguaScripts due)
CREATE INDEX IF NOT EXISTS saved_words_due_idx 
ON saved_words(user_id, language, appearance_count, created_at) 
WHERE appearance_count < 3;

-- Add index for flashcard query (finding due reinforcement reviews)
CREATE INDEX IF NOT EXISTS saved_words_flashcard_due_idx 
ON saved_words(user_id, language, next_review_at, appearance_count) 
WHERE appearance_count > 2 AND next_review_at IS NOT NULL;
```

## New Table: `linguascript_reviews`

This table logs each exercise attempt for data collection and future algorithm refinement.

```sql
CREATE TABLE IF NOT EXISTS linguascript_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES saved_words(id) ON DELETE CASCADE,
  correct BOOLEAN NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('gap-fill', 'mcq', 'speaking')), -- Exercise type
  timestamp TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Add index for analytics
CREATE INDEX IF NOT EXISTS linguascript_reviews_user_idx 
ON linguascript_reviews(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS linguascript_reviews_word_idx 
ON linguascript_reviews(word_id);
```

## What These Changes Do

### `context_phrase` + `context_translation`
- Stores the actual sentence/phrase from Netflix/YouTube where the word appeared
- Example: User clicks "café" in "Je vais au café ce matin" → stores full phrase
- Displayed to user during LinguaScript exercises for better learning context

### `appearance_count`
- Tracks how many times a word has appeared in LinguaScripts
- MVP: words with appearance_count < 3 are ready for review
- Later: used to determine when words graduate from "learning" to "reinforcement"

### `next_review_at`
- For future SRS: timestamp when word should next be reviewed
- `useLinguaScriptStatus` checks: words with appearance_count > 2 AND next_review_at <= now()
- Currently nullable; will be set once SRS algorithm is validated

### `linguascript_reviews` Table
- Every exercise attempt is logged with:
  - Whether user answered correctly
  - Which exercise mode (gap-fill, MCQ, speaking)
  - Timestamp
- This data feeds future algorithm improvements
- No state updates yet; pure data collection

## Migration Steps

1. **Add columns to `saved_words`** (recommended)
   - Use Supabase dashboard → SQL Editor
   - Copy the `ALTER TABLE` statement above
   - Execute

2. **Create `linguascript_reviews` table** (recommended)
   - Copy the `CREATE TABLE` statement above
   - Execute in SQL Editor

3. **Create indexes** (optional but recommended for performance)
   - Copy both `CREATE INDEX` statements
   - Execute in SQL Editor

## Notes

- These changes are **backward compatible** — existing code continues to work
- `appearance_count` defaults to 0; old saved_words have 0 automatically
- `next_review_at` is NULL for all existing words (not yet reviewed)
- No state changes happen automatically yet — we're collecting data first

## Testing

After migration, verify:
```sql
-- Should return words not yet reviewed
SELECT COUNT(*) FROM saved_words 
WHERE user_id = YOUR_USER_ID 
AND appearance_count < 3;

-- Should return reviews from today
SELECT COUNT(*) FROM linguascript_reviews 
WHERE user_id = YOUR_USER_ID 
AND DATE(created_at) = TODAY;
```
