ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS is_phrase BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS saved_words_user_phrase_idx ON public.saved_words(user_id, is_phrase);