-- Text-to-image flashcards: cache one openly-licensed image per saved word so
-- Flashcards can offer a "Text ↔ Image" card type alongside plain
-- "Text ↔ Text". Nullable + fetched lazily — a word without an image yet (or
-- one Openverse has no good match for) just falls back to the text card.
ALTER TABLE public.saved_words
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_attribution text;
