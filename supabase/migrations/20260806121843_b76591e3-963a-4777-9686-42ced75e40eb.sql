ALTER TABLE public.linguascripts
  ADD COLUMN IF NOT EXISTS scheduled_for timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS word_state text NOT NULL DEFAULT 'red';

UPDATE public.linguascripts SET scheduled_for = created_at WHERE created_at IS NOT NULL;

UPDATE public.linguascripts ls
   SET word_state = sw.state
  FROM public.saved_words sw
 WHERE sw.id = ls.saved_word_id
   AND sw.state IN ('red','orange','green');

CREATE INDEX IF NOT EXISTS linguascripts_due_idx
  ON public.linguascripts (user_id, language, scheduled_for)
  WHERE completed_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linguascripts TO authenticated;
GRANT ALL ON public.linguascripts TO service_role;

ALTER TABLE public.linguascripts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own linguascripts" ON public.linguascripts;
CREATE POLICY "Users manage their own linguascripts"
  ON public.linguascripts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.linguascripts REPLICA IDENTITY FULL;
ALTER TABLE public.saved_words REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='linguascripts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.linguascripts;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='saved_words') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.saved_words;
  END IF;
END $$;