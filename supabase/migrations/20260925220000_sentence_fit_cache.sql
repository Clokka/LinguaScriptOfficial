-- Sentence Lab, Step 3: caches the answer to "does this word meaningfully
-- complete this frame?" once per (pattern, word) pair, shared across every
-- learner — the question is about the language, not about any one user, so
-- the same AI call should never happen twice for the same pair. Only
-- reached when a candidate's word type already fits the gap (checked with
-- core_vocabulary.pos first) and it's just the *meaning* that's unclear.
CREATE TABLE IF NOT EXISTS public.sentence_fit_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id UUID NOT NULL,
  candidate_word TEXT NOT NULL,
  fits BOOLEAN NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pattern_id, candidate_word)
);

ALTER TABLE public.sentence_fit_cache ENABLE ROW LEVEL SECURITY;

-- Read-only for the app (it only ever checks the cache before deciding
-- whether to call the AI at all); only the edge function (service role)
-- writes new results.
DROP POLICY IF EXISTS "Anyone can read the sentence fit cache" ON public.sentence_fit_cache;
CREATE POLICY "Anyone can read the sentence fit cache" ON public.sentence_fit_cache
  FOR SELECT USING (true);

GRANT SELECT ON public.sentence_fit_cache TO anon, authenticated;
GRANT ALL ON public.sentence_fit_cache TO service_role;
