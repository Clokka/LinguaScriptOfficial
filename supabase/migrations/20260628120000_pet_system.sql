-- Pet collection table
CREATE TABLE IF NOT EXISTS pet_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id text NOT NULL,
  unlocked_at timestamptz DEFAULT now(),
  gifted_from uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(user_id, pet_id)
);

ALTER TABLE pet_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own collection" ON pet_collection
  FOR ALL USING (auth.uid() = user_id);

-- Active pet on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS active_pet text DEFAULT NULL;

-- Gift log table (sender keeps their pet; recipient gets a copy)
CREATE TABLE IF NOT EXISTS pet_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pet_id text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

ALTER TABLE pet_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own gifts" ON pet_gifts
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users send gifts" ON pet_gifts
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Function: gift a pet to another user by their display_name or email
CREATE OR REPLACE FUNCTION gift_pet(p_recipient_username text, p_pet_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_recipient_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find recipient by display_name
  SELECT user_id INTO v_recipient_id
  FROM profiles
  WHERE display_name ILIKE p_recipient_username
  LIMIT 1;

  IF v_recipient_id IS NULL THEN
    RETURN json_build_object('error', 'User not found');
  END IF;

  IF v_recipient_id = v_sender_id THEN
    RETURN json_build_object('error', 'Cannot gift to yourself');
  END IF;

  -- Check sender owns the pet
  IF NOT EXISTS (
    SELECT 1 FROM pet_collection
    WHERE user_id = v_sender_id AND pet_id = p_pet_id
  ) THEN
    RETURN json_build_object('error', 'You do not own this pet');
  END IF;

  -- Give recipient the pet (upsert so duplicates are safe)
  INSERT INTO pet_collection (user_id, pet_id, gifted_from)
  VALUES (v_recipient_id, p_pet_id, v_sender_id)
  ON CONFLICT (user_id, pet_id) DO NOTHING;

  -- Log the gift
  INSERT INTO pet_gifts (sender_id, recipient_id, pet_id)
  VALUES (v_sender_id, v_recipient_id, p_pet_id);

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION gift_pet(text, text) TO authenticated;
