
CREATE TABLE public.starter_decks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📘',
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.starter_decks TO anon, authenticated;
GRANT ALL ON public.starter_decks TO service_role;
ALTER TABLE public.starter_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Starter decks readable by all" ON public.starter_decks FOR SELECT USING (true);

CREATE TABLE public.starter_deck_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deck_id UUID NOT NULL REFERENCES public.starter_decks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  word TEXT NOT NULL,
  translation TEXT NOT NULL,
  reading TEXT NOT NULL DEFAULT '',
  ipa TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.starter_deck_cards TO anon, authenticated;
GRANT ALL ON public.starter_deck_cards TO service_role;
ALTER TABLE public.starter_deck_cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Starter deck cards readable by all" ON public.starter_deck_cards FOR SELECT USING (true);
CREATE INDEX starter_deck_cards_deck_idx ON public.starter_deck_cards(deck_id, position);
