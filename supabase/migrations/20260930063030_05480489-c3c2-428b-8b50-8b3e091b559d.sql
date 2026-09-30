CREATE TABLE public.vocab_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  language text NOT NULL,
  word text NOT NULL,
  native_language text NOT NULL,
  translation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (language, word, native_language)
);
GRANT SELECT ON public.vocab_translations TO anon, authenticated;
GRANT ALL ON public.vocab_translations TO service_role;
ALTER TABLE public.vocab_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read vocab translations" ON public.vocab_translations FOR SELECT USING (true);
CREATE INDEX vocab_translations_lookup ON public.vocab_translations (language, native_language, word);