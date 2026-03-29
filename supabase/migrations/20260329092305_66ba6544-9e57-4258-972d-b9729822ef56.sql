CREATE TABLE public.subtitles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  film_id UUID REFERENCES public.films(id) ON DELETE CASCADE NOT NULL,
  start_time DOUBLE PRECISION NOT NULL,
  end_time DOUBLE PRECISION NOT NULL,
  text TEXT NOT NULL,
  translation TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.subtitles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view subtitles" ON public.subtitles FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can insert subtitles" ON public.subtitles FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can delete subtitles" ON public.subtitles FOR DELETE TO public USING (true);