ALTER TABLE public.subtitles ADD COLUMN language text NOT NULL DEFAULT 'fr';

CREATE UNIQUE INDEX subtitles_film_language_sort ON public.subtitles (film_id, language, sort_order);