-- Phase 1: LinguaScripts from Saved Words
-- This migration creates RPC functions to generate exercises from user's saved vocabulary

-- 1. RPC: Get words that need review today
CREATE OR REPLACE FUNCTION public.get_words_needing_review(
  p_user_id uuid,
  p_language varchar,
  p_limit integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  word varchar,
  translation text,
  context text,
  state varchar,
  next_review date,
  review_count integer,
  times_correct integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sw.id,
    sw.word,
    sw.translation,
    sw.context,
    sw.state,
    sw.next_review,
    sw.review_count,
    sw.times_correct
  FROM public.saved_words sw
  WHERE sw.user_id = p_user_id
    AND sw.language = p_language
    AND sw.next_review <= CURRENT_DATE
    AND sw.state IN ('red', 'orange')
  ORDER BY sw.next_review ASC, sw.review_count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: Create LinguaScript from saved word
CREATE OR REPLACE FUNCTION public.create_linguascript_from_saved_word(
  p_user_id uuid,
  p_saved_word_id uuid,
  p_word varchar,
  p_translation text,
  p_language varchar,
  p_context text,
  p_gap_options jsonb,
  p_mcq_options jsonb
)
RETURNS uuid AS $$
DECLARE
  v_linguascript_id uuid;
BEGIN
  INSERT INTO public.linguascripts (
    user_id,
    language,
    target_word,
    sentence,
    translation,
    gap_position,
    gap_options,
    mcq_options,
    saved_word_id,
    status
  )
  VALUES (
    p_user_id,
    p_language,
    p_word,
    p_context,
    p_translation,
    1,
    p_gap_options,
    p_mcq_options,
    p_saved_word_id,
    'pending'
  )
  RETURNING id INTO v_linguascript_id;

  RETURN v_linguascript_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: Update SRS after LinguaScript completion
CREATE OR REPLACE FUNCTION public.update_srs_after_linguascript(
  p_linguascript_id uuid,
  p_user_id uuid,
  p_correct boolean
)
RETURNS void AS $$
DECLARE
  v_saved_word_id uuid;
  v_current_state varchar;
  v_new_state varchar;
  v_next_review date;
BEGIN
  -- Get the saved word ID from linguascript
  SELECT saved_word_id INTO v_saved_word_id
  FROM public.linguascripts
  WHERE id = p_linguascript_id AND user_id = p_user_id;

  IF v_saved_word_id IS NULL THEN
    RETURN;
  END IF;

  -- Get current state
  SELECT state INTO v_current_state
  FROM public.saved_words
  WHERE id = v_saved_word_id;

  -- Determine new state and next review based on correctness
  IF p_correct THEN
    -- Move forward in SRS progression
    v_new_state := CASE v_current_state
      WHEN 'red' THEN 'orange'
      WHEN 'orange' THEN 'green'
      ELSE 'green'
    END;

    v_next_review := CASE v_new_state
      WHEN 'orange' THEN CURRENT_DATE + INTERVAL '3 days'
      WHEN 'green' THEN CURRENT_DATE + INTERVAL '7 days'
      ELSE CURRENT_DATE + INTERVAL '1 day'
    END;
  ELSE
    -- Reset to red if incorrect
    v_new_state := 'red';
    v_next_review := CURRENT_DATE + INTERVAL '1 day';
  END IF;

  -- Update saved word
  UPDATE public.saved_words
  SET
    state = v_new_state,
    next_review = v_next_review,
    review_count = review_count + 1,
    times_correct = times_correct + (CASE WHEN p_correct THEN 1 ELSE 0 END),
    updated_at = now()
  WHERE id = v_saved_word_id;

  -- Mark linguascript as completed
  UPDATE public.linguascripts
  SET
    status = 'completed',
    correct = p_correct,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_linguascript_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_words_needing_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_linguascript_from_saved_word TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_srs_after_linguascript TO authenticated;
