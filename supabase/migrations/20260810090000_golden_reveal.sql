-- The Golden Reveal — a word promoted to green renders GOLD until the learner
-- has actually witnessed the promotion and claimed it.
--
-- Two new columns on saved_words:
--
--   green_revealed_at  when the learner claimed (or auto-claimed) the gold.
--                      Compared against state_changed_at rather than stored as
--                      a boolean, so a word that slips back to orange and is
--                      re-promoted re-arms the gold automatically. A boolean
--                      would fire once per word for the life of the account.
--
--   gold_seen_count    how many subtitle lines this word has appeared in while
--                      gold. Past GOLD_DECAY_APPEARANCES it auto-reveals so an
--                      ignored word stops glittering forever.
--
-- NOTE: appearance_count is NOT reusable here. It is incremented only by
-- LinguaScriptExercise (times shown in an exercise), and useLinguaScriptStatus
-- gates flashcard readiness on appearance_count >= 3 — overloading it would
-- silently corrupt that gate.

ALTER TABLE saved_words
  ADD COLUMN IF NOT EXISTS green_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gold_seen_count integer NOT NULL DEFAULT 0;

-- Finding the pending-green words for a learner is a hot path on every
-- subtitle line, so index the shape the query actually uses.
CREATE INDEX IF NOT EXISTS saved_words_pending_green_idx
  ON saved_words (user_id, language)
  WHERE state = 'green';

/**
 * Claim a gold word into green.
 *
 * Idempotent: a double-tap, a re-render, or a retry after a dropped connection
 * cannot stamp twice, so the jingle and the XP fire exactly once.
 *
 * Returns json { revealed: bool, awarded_xp: int } — `revealed` is false when
 * the word was already claimed, which the client uses to suppress the sound.
 */
CREATE OR REPLACE FUNCTION reveal_green_word(p_word_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_row saved_words%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_row
  FROM saved_words
  WHERE id = p_word_id AND user_id = v_user_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  -- Only a green word that hasn't been witnessed since its promotion is gold.
  IF v_row.state <> 'green'
     OR (v_row.green_revealed_at IS NOT NULL
         AND v_row.green_revealed_at >= COALESCE(v_row.state_changed_at, v_row.created_at))
  THEN
    RETURN json_build_object('revealed', false, 'awarded_xp', 0);
  END IF;

  UPDATE saved_words
  SET green_revealed_at = now()
  WHERE id = p_word_id;

  RETURN json_build_object('revealed', true, 'awarded_xp', 5);
END;
$$;

GRANT EXECUTE ON FUNCTION reveal_green_word(uuid) TO authenticated;

/**
 * Record that a gold word appeared in another subtitle line, and auto-claim it
 * once it has been ignored enough times.
 *
 * Auto-claimed words are deliberately silent — no XP, no jingle. The reward is
 * for the click; passive watching must not farm it.
 */
CREATE OR REPLACE FUNCTION touch_gold_word(p_word_id uuid, p_decay_at integer DEFAULT 3)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  UPDATE saved_words
  SET gold_seen_count = gold_seen_count + 1
  WHERE id = p_word_id AND user_id = v_user_id
  RETURNING gold_seen_count INTO v_count;

  IF v_count IS NULL THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_count >= p_decay_at THEN
    UPDATE saved_words
    SET green_revealed_at = now()
    WHERE id = p_word_id AND green_revealed_at IS NULL;
    RETURN json_build_object('seen', v_count, 'auto_revealed', true);
  END IF;

  RETURN json_build_object('seen', v_count, 'auto_revealed', false);
END;
$$;

GRANT EXECUTE ON FUNCTION touch_gold_word(uuid, integer) TO authenticated;
