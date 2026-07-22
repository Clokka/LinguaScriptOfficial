-- Phase 0: LinguaScripts Tables & RPC
-- This migration creates the foundation for the active recall system

-- 1. Create linguascripts table
CREATE TABLE IF NOT EXISTS public.linguascripts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  language varchar NOT NULL DEFAULT 'fr',
  target_word varchar NOT NULL,
  sentence text NOT NULL,
  translation text NOT NULL,
  interest varchar,
  gap_position integer DEFAULT 0,
  gap_options jsonb DEFAULT '{"correct":"","distractors":[]}',
  mcq_options jsonb DEFAULT '{"correct":0,"options":[]}',
  audio_url text,

  -- Status tracking
  status varchar DEFAULT 'pending' CHECK (status IN ('pending', 'started', 'completed', 'skipped')),
  gap_answer varchar,
  mcq_answer integer,
  speaking_answer varchar,
  correct boolean DEFAULT false,
  attempts integer DEFAULT 0,
  time_spent_ms integer,

  -- SRS integration
  scheduled_to_srs boolean DEFAULT false,
  saved_word_id uuid REFERENCES public.saved_words(id) ON DELETE SET NULL,

  -- XP & Combo
  combo_multiplier integer DEFAULT 1,
  xp_earned integer DEFAULT 0,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_linguascripts_user_id ON public.linguascripts(user_id);
CREATE INDEX IF NOT EXISTS idx_linguascripts_created_at ON public.linguascripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_linguascripts_status ON public.linguascripts(status);
CREATE INDEX IF NOT EXISTS idx_linguascripts_user_language ON public.linguascripts(user_id, language);

-- 2. RPC: Get daily LinguaScripts for a user
CREATE OR REPLACE FUNCTION public.get_daily_linguascripts(
  p_user_id uuid,
  p_language varchar
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  language varchar,
  target_word varchar,
  sentence text,
  translation text,
  interest varchar,
  gap_position integer,
  gap_options jsonb,
  mcq_options jsonb,
  audio_url text,
  status varchar,
  gap_answer varchar,
  mcq_answer integer,
  speaking_answer varchar,
  correct boolean,
  attempts integer,
  time_spent_ms integer,
  scheduled_to_srs boolean,
  combo_multiplier integer,
  xp_earned integer,
  created_at timestamptz,
  completed_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.id,
    ls.user_id,
    ls.language,
    ls.target_word,
    ls.sentence,
    ls.translation,
    ls.interest,
    ls.gap_position,
    ls.gap_options,
    ls.mcq_options,
    ls.audio_url,
    ls.status,
    ls.gap_answer,
    ls.mcq_answer,
    ls.speaking_answer,
    ls.correct,
    ls.attempts,
    ls.time_spent_ms,
    ls.scheduled_to_srs,
    ls.combo_multiplier,
    ls.xp_earned,
    ls.created_at,
    ls.completed_at
  FROM public.linguascripts ls
  WHERE ls.user_id = p_user_id
    AND ls.language = p_language
    AND (ls.created_at::date = CURRENT_DATE OR ls.status != 'completed')
  ORDER BY ls.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Schedule LinguaScript word to SRS
CREATE OR REPLACE FUNCTION public.schedule_linguascript_to_srs(
  p_linguascript_id uuid,
  p_user_id uuid
)
RETURNS void AS $$
DECLARE
  v_target_word varchar;
  v_translation text;
  v_language varchar;
  v_sentence text;
BEGIN
  -- Get linguascript details
  SELECT target_word, translation, language, sentence
  INTO v_target_word, v_translation, v_language, v_sentence
  FROM public.linguascripts
  WHERE id = p_linguascript_id AND user_id = p_user_id;

  IF v_target_word IS NULL THEN
    RAISE EXCEPTION 'LinguaScript not found';
  END IF;

  -- Mark as scheduled
  UPDATE public.linguascripts
  SET scheduled_to_srs = true, updated_at = now()
  WHERE id = p_linguascript_id;

  -- Create or update saved_word with SRS scheduling
  INSERT INTO public.saved_words (
    user_id, word, translation, language, context,
    review_count, times_correct, state, next_review
  )
  VALUES (
    p_user_id,
    v_target_word,
    v_translation,
    v_language,
    v_sentence,
    0,
    1,
    'red',
    CURRENT_DATE + INTERVAL '1 day'
  )
  ON CONFLICT (user_id, word, language) DO UPDATE SET
    review_count = saved_words.review_count + 1,
    times_correct = CASE WHEN saved_words.review_count > 0 THEN saved_words.times_correct + 1 ELSE 1 END,
    next_review = CURRENT_DATE + INTERVAL '1 day',
    updated_at = now()
  WHERE saved_words.user_id = p_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Create a LinguaScript for today
CREATE OR REPLACE FUNCTION public.create_daily_linguascript(
  p_user_id uuid,
  p_language varchar,
  p_target_word varchar,
  p_sentence text,
  p_translation text,
  p_interest varchar,
  p_gap_position integer,
  p_gap_options jsonb,
  p_mcq_options jsonb
)
RETURNS uuid AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.linguascripts (
    user_id, language, target_word, sentence, translation,
    interest, gap_position, gap_options, mcq_options, status
  )
  VALUES (
    p_user_id, p_language, p_target_word, p_sentence, p_translation,
    p_interest, p_gap_position, p_gap_options, p_mcq_options, 'pending'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.linguascripts TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_daily_linguascripts TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_linguascript_to_srs TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_daily_linguascript TO authenticated;
