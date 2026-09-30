-- Hand-built recommendation topics for a single learner.
--
-- Onboarding interests are a fixed list of broad categories. When we close a
-- customer we often know something far more specific ("makes pottery, wants
-- Italian") — this table lets an admin give that one account its own topic
-- rails with exact YouTube search phrases per learning language. The topics
-- show at the top of the learner's Discover feed, above their onboarding
-- interests, and pick up the same click-based reordering (the rail id is
-- 'c:<uuid>', 38 chars, under record_feed_event's 40-char limit).
CREATE TABLE IF NOT EXISTS public.custom_feed_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 60),
  emoji TEXT NOT NULL DEFAULT '✨' CHECK (length(emoji) <= 16),
  -- { "it": ["ceramica al tornio", ...], "fr": [...] } — searched as written.
  queries JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Used for any language without its own phrases: "<Language> <fallback>".
  fallback_query TEXT CHECK (fallback_query IS NULL OR length(fallback_query) <= 120),
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_custom_feed_topics_user ON public.custom_feed_topics(user_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_feed_topics TO authenticated;
GRANT ALL ON public.custom_feed_topics TO service_role;

ALTER TABLE public.custom_feed_topics ENABLE ROW LEVEL SECURITY;

-- Learners read their own topics (PersonalizedRails); admins read everyone's.
CREATE POLICY "Users read own custom feed topics"
  ON public.custom_feed_topics FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Only admins write: these are curated by us, not self-serve.
CREATE POLICY "Admins insert custom feed topics"
  ON public.custom_feed_topics FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update custom feed topics"
  ON public.custom_feed_topics FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete custom feed topics"
  ON public.custom_feed_topics FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));
