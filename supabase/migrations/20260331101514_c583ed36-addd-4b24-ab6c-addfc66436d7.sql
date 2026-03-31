
CREATE TABLE public.saved_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  word text NOT NULL,
  translation text NOT NULL DEFAULT '',
  pronunciation text NOT NULL DEFAULT '',
  ipa text NOT NULL DEFAULT '',
  context text DEFAULT '',
  film_id uuid REFERENCES public.films(id) ON DELETE SET NULL,
  language text NOT NULL DEFAULT 'fr',
  interval_days integer NOT NULL DEFAULT 1,
  ease_factor numeric NOT NULL DEFAULT 2.5,
  next_review date NOT NULL DEFAULT CURRENT_DATE,
  review_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_words ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved words" ON public.saved_words
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved words" ON public.saved_words
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved words" ON public.saved_words
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved words" ON public.saved_words
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE UNIQUE INDEX saved_words_user_word_lang ON public.saved_words (user_id, word, language);
