-- Fix saved_words that have missing or future next_review dates
-- This ensures words immediately appear in get_words_needing_review() for review today

-- Set next_review to today for any word with NULL or future dates
UPDATE public.saved_words
SET next_review = CURRENT_DATE
WHERE next_review IS NULL OR next_review > CURRENT_DATE;

-- Ensure state is 'red' (not NULL) for any new/unseen words
UPDATE public.saved_words
SET state = 'red'
WHERE state IS NULL;

-- Add updated_at timestamp if the table has it
UPDATE public.saved_words
SET updated_at = now()
WHERE next_review = CURRENT_DATE OR state = 'red';
