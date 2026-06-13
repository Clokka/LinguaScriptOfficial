
-- Core vocabulary master list
CREATE TABLE public.core_vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  language TEXT NOT NULL DEFAULT 'fr',
  rank INTEGER NOT NULL,
  word TEXT NOT NULL,
  lemma TEXT NOT NULL,
  translation TEXT NOT NULL,
  pos TEXT,
  example_fr TEXT,
  example_en TEXT,
  frequency_weight DOUBLE PRECISION NOT NULL DEFAULT 0,
  audio_url TEXT,
  image_url TEXT,
  topic TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (language, rank),
  UNIQUE (language, lemma)
);

GRANT SELECT ON public.core_vocabulary TO anon, authenticated;
GRANT ALL ON public.core_vocabulary TO service_role;

ALTER TABLE public.core_vocabulary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Core vocabulary is readable by everyone"
  ON public.core_vocabulary FOR SELECT
  USING (true);

CREATE INDEX idx_core_vocab_lang_rank ON public.core_vocabulary (language, rank);
CREATE INDEX idx_core_vocab_lemma ON public.core_vocabulary (language, lemma);

CREATE TRIGGER trg_core_vocab_updated
BEFORE UPDATE ON public.core_vocabulary
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- Per-user state per word
CREATE TYPE public.vocab_state AS ENUM ('red', 'orange', 'green');

CREATE TABLE public.user_vocabulary_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES public.core_vocabulary(id) ON DELETE CASCADE,
  state public.vocab_state NOT NULL DEFAULT 'orange',
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, word_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_vocabulary_state TO authenticated;
GRANT ALL ON public.user_vocabulary_state TO service_role;

ALTER TABLE public.user_vocabulary_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own vocab state"
  ON public.user_vocabulary_state FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own vocab state"
  ON public.user_vocabulary_state FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own vocab state"
  ON public.user_vocabulary_state FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own vocab state"
  ON public.user_vocabulary_state FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_vocab_user ON public.user_vocabulary_state (user_id);
CREATE INDEX idx_user_vocab_user_state ON public.user_vocabulary_state (user_id, state);

CREATE TRIGGER trg_user_vocab_updated
BEFORE UPDATE ON public.user_vocabulary_state
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
