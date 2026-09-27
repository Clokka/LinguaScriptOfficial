CREATE TABLE public.word_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL,
  surface text NOT NULL,
  lemma text NOT NULL,
  pos text NOT NULL,
  form text,
  person text,
  number text,
  tense text,
  mood text,
  source text NOT NULL DEFAULT 'ai',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language, surface)
);
GRANT SELECT ON public.word_forms TO anon, authenticated;
GRANT ALL ON public.word_forms TO service_role;
ALTER TABLE public.word_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Word forms are readable by everyone" ON public.word_forms FOR SELECT USING (true);
CREATE TRIGGER update_word_forms_updated_at BEFORE UPDATE ON public.word_forms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS word_form_id uuid REFERENCES public.word_forms(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS saved_words_word_form_idx ON public.saved_words(word_form_id);
ALTER TABLE public.linguascripts ADD COLUMN IF NOT EXISTS stage smallint NOT NULL DEFAULT 1;