-- Shareable single-use gift links
CREATE TABLE IF NOT EXISTS pet_gift_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  sender_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pet_id text NOT NULL,
  claimed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '30 days'
);

ALTER TABLE pet_gift_links ENABLE ROW LEVEL SECURITY;

-- Sender can view their own links
CREATE POLICY "Sender views own links" ON pet_gift_links
  FOR SELECT USING (auth.uid() = sender_id);

-- Anyone authenticated can view a link by token (for claiming)
CREATE POLICY "Anyone can view unclaimed links" ON pet_gift_links
  FOR SELECT USING (true);

-- Only authenticated users can create links
CREATE POLICY "Authenticated users create links" ON pet_gift_links
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Function: create a shareable gift link
CREATE OR REPLACE FUNCTION create_gift_link(p_pet_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_token text;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Check sender owns the pet
  IF NOT EXISTS (
    SELECT 1 FROM pet_collection
    WHERE user_id = v_sender_id AND pet_id = p_pet_id
  ) THEN
    RETURN json_build_object('error', 'You do not own this pet');
  END IF;

  -- Generate a short, readable token
  v_token := encode(gen_random_bytes(12), 'base64');
  v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');

  INSERT INTO pet_gift_links (sender_id, pet_id, token)
  VALUES (v_sender_id, p_pet_id, v_token);

  RETURN json_build_object('token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION create_gift_link(text) TO authenticated;

-- Function: claim a gift link
CREATE OR REPLACE FUNCTION claim_gift_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimer_id uuid := auth.uid();
  v_link pet_gift_links%ROWTYPE;
BEGIN
  IF v_claimer_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_link
  FROM pet_gift_links
  WHERE token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Link not found');
  END IF;

  IF v_link.claimed_by IS NOT NULL THEN
    RETURN json_build_object('error', 'This gift has already been claimed');
  END IF;

  IF v_link.expires_at < now() THEN
    RETURN json_build_object('error', 'This gift link has expired');
  END IF;

  IF v_link.sender_id = v_claimer_id THEN
    RETURN json_build_object('error', 'You cannot claim your own gift');
  END IF;

  -- Give the pet to the claimer
  INSERT INTO pet_collection (user_id, pet_id, gifted_from)
  VALUES (v_claimer_id, v_link.pet_id, v_link.sender_id)
  ON CONFLICT (user_id, pet_id) DO NOTHING;

  -- Mark link as claimed
  UPDATE pet_gift_links
  SET claimed_by = v_claimer_id, claimed_at = now()
  WHERE token = p_token;

  -- Log the gift
  INSERT INTO pet_gifts (sender_id, recipient_id, pet_id)
  VALUES (v_link.sender_id, v_claimer_id, v_link.pet_id)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object('success', true, 'pet_id', v_link.pet_id);
END;
$$;

GRANT EXECUTE ON FUNCTION claim_gift_link(text) TO authenticated;
