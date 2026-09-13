ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS image_attribution text;
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS lemma text;
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS lemma_translation text;
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS is_inflected boolean DEFAULT false;
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS grammar_note text;
ALTER TABLE public.saved_words ADD COLUMN IF NOT EXISTS pos text;