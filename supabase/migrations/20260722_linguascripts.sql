-- LinguaScripts: AI-generated sentence learning with gap-fill, MCQ, and speaking modes
-- Integrates with SRS for automatic word scheduling after completion

CREATE TABLE IF NOT EXISTS linguascripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  language text NOT NULL,
  target_word text NOT NULL,

  -- Core content
  sentence text NOT NULL,  -- "Je voudrais un café noir, s'il vous plaît"
  translation text NOT NULL,  -- English translation

  -- Interest/personalization (which interest category this was generated for)
  interest text,  -- e.g., "cooking", "travel", "technology"

  -- Gap-fill mode
  gap_position int NOT NULL,  -- word index in sentence array
  gap_options jsonb NOT NULL,  -- { "correct": word, "distractors": [...] }

  -- Multiple-choice mode
  mcq_options jsonb NOT NULL,  -- { "correct": 0, "options": [trans1, trans2, trans3, trans4] }

  -- Speaking mode
  audio_url text,  -- pre-recorded native speaker pronunciation

  -- Exercise tracking
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  status text DEFAULT 'pending',  -- pending, started, completed, skipped

  -- Answers
  gap_answer text,  -- what user typed for gap-fill
  mcq_answer int,  -- which option they selected (0-3)
  speaking_answer text,  -- transcribed user speech

  -- Performance
  correct boolean,  -- was their answer correct?
  attempts int DEFAULT 0,
  time_spent_ms int,  -- how long they spent on this exercise

  -- SRS scheduling (set after completion)
  scheduled_to_srs boolean DEFAULT false,
  srs_word_id uuid REFERENCES saved_words(id) ON DELETE SET NULL,

  -- Combo tracking for XP
  combo_multiplier int DEFAULT 1,
  xp_earned int
);

ALTER TABLE linguascripts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own LinguaScripts" ON linguascripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create LinguaScripts" ON linguascripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own LinguaScripts" ON linguascripts
  FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_linguascripts_user_language
  ON linguascripts(user_id, language);
CREATE INDEX IF NOT EXISTS idx_linguascripts_status
  ON linguascripts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_linguascripts_created
  ON linguascripts(user_id, created_at DESC);

-- Function to get today's LinguaScripts (for "Today's Mission" UI)
CREATE OR REPLACE FUNCTION get_daily_linguascripts(p_user_id uuid, p_language text)
RETURNS TABLE(
  id uuid,
  target_word text,
  sentence text,
  translation text,
  status text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.target_word,
    l.sentence,
    l.translation,
    l.status,
    l.created_at
  FROM linguascripts l
  WHERE l.user_id = p_user_id
    AND l.language = p_language
    AND DATE(l.created_at) = CURRENT_DATE
  ORDER BY l.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_daily_linguascripts(uuid, text) TO authenticated;

-- Function to schedule a completed LinguaScript's word into the SRS
CREATE OR REPLACE FUNCTION schedule_linguascript_to_srs(
  p_linguascript_id uuid,
  p_user_id uuid
) RETURNS json AS $$
DECLARE
  v_target_word text;
  v_language text;
  v_correct boolean;
  v_word_id uuid;
BEGIN
  -- Get the LinguaScript details
  SELECT l.target_word, l.language, l.correct
  INTO v_target_word, v_language, v_correct
  FROM linguascripts l
  WHERE l.id = p_linguascript_id AND l.user_id = p_user_id;

  IF v_target_word IS NULL THEN
    RETURN json_build_object('error', 'LinguaScript not found');
  END IF;

  -- If the word doesn't exist in saved_words, create it (red state)
  -- If it does exist and was answered correctly, move it to orange/green
  INSERT INTO saved_words (user_id, word, language, state, times_correct, review_count)
  VALUES (p_user_id, v_target_word, v_language,
          CASE WHEN v_correct THEN 'orange' ELSE 'red' END,
          CASE WHEN v_correct THEN 1 ELSE 0 END,
          1)
  ON CONFLICT (user_id, word, language) DO UPDATE SET
    times_correct = saved_words.times_correct + (CASE WHEN v_correct THEN 1 ELSE 0 END),
    review_count = saved_words.review_count + 1,
    state = CASE
      WHEN v_correct AND saved_words.state = 'red' THEN 'orange'
      WHEN v_correct AND saved_words.state = 'orange' THEN 'green'
      ELSE saved_words.state
    END,
    next_review_at = CASE
      WHEN v_correct THEN CURRENT_TIMESTAMP + INTERVAL '1 day'
      ELSE CURRENT_TIMESTAMP + INTERVAL '4 hours'
    END
  RETURNING id INTO v_word_id;

  -- Mark the LinguaScript as scheduled
  UPDATE linguascripts
  SET scheduled_to_srs = true, srs_word_id = v_word_id
  WHERE id = p_linguascript_id;

  RETURN json_build_object('success', true, 'word_id', v_word_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION schedule_linguascript_to_srs(uuid, uuid) TO authenticated;
