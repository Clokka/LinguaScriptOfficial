-- "Words saved today" counts words saved FROM A VIDEO today, even if the word
-- was already in the deck (a daily frequency word, or one marked known at
-- setup). It used to count words *created* today, so saving a word the app
-- had added earlier made the counter jump up and straight back down.
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS video_saved_at timestamptz;

-- Words already saved from a video keep counting on the day they were saved.
UPDATE public.saved_words
SET video_saved_at = created_at
WHERE video_saved_at IS NULL AND film_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS saved_words_user_lang_video_saved_idx
  ON public.saved_words (user_id, language, video_saved_at);
