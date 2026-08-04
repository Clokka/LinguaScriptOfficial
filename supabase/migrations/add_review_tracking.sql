-- Add linguascript_reviews table for tracking review performance
-- This table stores data about each review attempt (gap-fill, active recall, linguascript)

CREATE TABLE IF NOT EXISTS linguascript_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Foreign keys
  exercise_id UUID NOT NULL REFERENCES linguascripts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Review details
  method_used TEXT NOT NULL CHECK (method_used IN ('gap-fill', 'active-recall', 'linguascript')),
  performance SMALLINT NOT NULL DEFAULT 0 CHECK (performance >= 0 AND performance <= 100),

  -- For active recall and linguascript: user's response
  user_text TEXT,

  -- AI feedback (for linguascript evaluation)
  ai_feedback TEXT,

  -- Timing and metadata
  response_time_ms INTEGER, -- milliseconds
  first_try_correct BOOLEAN DEFAULT false,
  session_id TEXT, -- group reviews into sessions

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_exercise_id
  ON linguascript_reviews(exercise_id);

CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_user_id
  ON linguascript_reviews(user_id);

CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_created_at
  ON linguascript_reviews(created_at);

CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_session_id
  ON linguascript_reviews(session_id);

-- Enable RLS
ALTER TABLE linguascript_reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies: users can only see their own reviews
CREATE POLICY "Users can view their own reviews"
  ON linguascript_reviews
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reviews"
  ON linguascript_reviews
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
  ON linguascript_reviews
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
