ALTER TABLE public.saved_words
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'red',
  ADD COLUMN IF NOT EXISTS times_correct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS state_changed_at timestamptz;

ALTER TABLE public.saved_words DROP CONSTRAINT IF EXISTS saved_words_state_check;
ALTER TABLE public.saved_words
  ADD CONSTRAINT saved_words_state_check CHECK (state IN ('red','orange','green'));

CREATE INDEX IF NOT EXISTS saved_words_user_state_idx ON public.saved_words(user_id, state);