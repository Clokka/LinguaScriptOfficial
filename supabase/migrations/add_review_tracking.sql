-- Create linguascript_reviews table for tracking review performance
-- Split into separate statements for Loveable SQL editor compatibility

CREATE TABLE IF NOT EXISTS linguascript_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linguascript_id UUID NOT NULL,
  user_id UUID NOT NULL,
  method_used TEXT NOT NULL,
  performance SMALLINT NOT NULL DEFAULT 0,
  user_text TEXT,
  ai_feedback TEXT,
  response_time_ms INTEGER,
  first_try_correct BOOLEAN DEFAULT false,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE linguascript_reviews ADD CONSTRAINT fk_linguascript_reviews_linguascript
  FOREIGN KEY (linguascript_id) REFERENCES linguascripts(id) ON DELETE CASCADE;

ALTER TABLE linguascript_reviews ADD CONSTRAINT fk_linguascript_reviews_user
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE linguascript_reviews ADD CONSTRAINT ck_method_used
  CHECK (method_used IN ('gap-fill', 'active-recall', 'linguascript'));

ALTER TABLE linguascript_reviews ADD CONSTRAINT ck_performance
  CHECK (performance >= 0 AND performance <= 100);

CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_linguascript_id ON linguascript_reviews(linguascript_id);
CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_user_id ON linguascript_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_created_at ON linguascript_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_linguascript_reviews_session_id ON linguascript_reviews(session_id);

ALTER TABLE linguascript_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reviews" ON linguascript_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own reviews" ON linguascript_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own reviews" ON linguascript_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
