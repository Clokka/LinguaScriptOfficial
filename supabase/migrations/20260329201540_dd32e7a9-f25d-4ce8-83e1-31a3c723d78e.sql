
-- Email signups table (public, no auth needed)
CREATE TABLE public.email_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.email_signups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can insert email signups" ON public.email_signups FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Anyone can view email signups" ON public.email_signups FOR SELECT TO public USING (true);

-- User lessons table (saved YouTube videos)
CREATE TABLE public.user_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  youtube_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  duration_seconds INTEGER DEFAULT 0,
  original_language TEXT DEFAULT 'en',
  progress_percent INTEGER DEFAULT 0,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, youtube_id)
);
ALTER TABLE public.user_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own lessons" ON public.user_lessons FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own lessons" ON public.user_lessons FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lessons" ON public.user_lessons FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lessons" ON public.user_lessons FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Activity log table (calendar tracking)
CREATE TABLE public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  minutes_watched INTEGER DEFAULT 0,
  videos_watched INTEGER DEFAULT 0,
  words_learned INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activity" ON public.activity_log FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own activity" ON public.activity_log FOR UPDATE TO authenticated USING (auth.uid() = user_id);
