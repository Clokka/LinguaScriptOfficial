-- Instant word translations: a curated top-5,000 dictionary per language.
-- Taps on common words are answered from this table straight away instead of
-- waiting on the AI (slow, and unreliable for tiny words like "que").
ALTER TABLE public.vocab_translations ADD COLUMN IF NOT EXISTS pronunciation text;
ALTER TABLE public.vocab_translations ADD COLUMN IF NOT EXISTS rank integer;
ALTER TABLE public.vocab_translations ADD COLUMN IF NOT EXISTS source text;
CREATE INDEX IF NOT EXISTS vocab_translations_rank
  ON public.vocab_translations (language, native_language, rank);
