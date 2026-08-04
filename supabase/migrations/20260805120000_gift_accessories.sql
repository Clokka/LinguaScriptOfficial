-- Gift link accessories + equipped items on a pet.
-- Lets an admin attach accessory ids (e.g. "sneakers", "trucker_hat") to a
-- specific gift link. On claim, one pet_equipment row is inserted per
-- accessory so the recipient keeps them forever.

-- 1. Accessories column on gift links
ALTER TABLE pet_gift_links
  ADD COLUMN IF NOT EXISTS accessories text[];

-- Bump default expiry from 30 to 90 days for future links
ALTER TABLE pet_gift_links
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '90 days');

-- 2. Equipment table (accessories a user has on a specific pet)
CREATE TABLE IF NOT EXISTS pet_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('head', 'feet', 'body')),
  accessory_id text NOT NULL,
  equipped boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, pet_id, slot)
);

ALTER TABLE pet_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own equipment" ON pet_equipment
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own equipment" ON pet_equipment
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users insert own equipment" ON pet_equipment
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Replace create_gift_link to accept an optional accessory array.
-- The previous signature is a different function to Postgres (different
-- arg list), so drop it explicitly to avoid overload ambiguity.
DROP FUNCTION IF EXISTS public.create_gift_link(text);

CREATE OR REPLACE FUNCTION create_gift_link(p_pet_id text, p_accessories text[] DEFAULT NULL)
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

  IF NOT EXISTS (
    SELECT 1 FROM pet_collection
    WHERE user_id = v_sender_id AND pet_id = p_pet_id
  ) THEN
    RETURN json_build_object('error', 'You do not own this pet');
  END IF;

  v_token := encode(gen_random_bytes(12), 'base64');
  v_token := replace(replace(replace(v_token, '+', ''), '/', ''), '=', '');

  INSERT INTO pet_gift_links (sender_id, pet_id, token, accessories)
  VALUES (v_sender_id, p_pet_id, v_token, p_accessories);

  RETURN json_build_object('token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION create_gift_link(text, text[]) TO authenticated;

-- 4. Replace claim_gift_link so it also inserts pet_equipment rows for
--    any accessories attached to the link.
CREATE OR REPLACE FUNCTION claim_gift_link(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claimer_id uuid := auth.uid();
  v_link pet_gift_links%ROWTYPE;
  v_accessory text;
  v_slot text;
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

  INSERT INTO pet_collection (user_id, pet_id, gifted_from)
  VALUES (v_claimer_id, v_link.pet_id, v_link.sender_id)
  ON CONFLICT (user_id, pet_id) DO NOTHING;

  IF v_link.accessories IS NOT NULL THEN
    FOREACH v_accessory IN ARRAY v_link.accessories LOOP
      -- Map accessory id → slot. Keep this in sync with src/lib/accessories.ts.
      v_slot := CASE v_accessory
        WHEN 'sneakers' THEN 'feet'
        WHEN 'trucker_hat' THEN 'head'
        ELSE NULL
      END;
      IF v_slot IS NOT NULL THEN
        INSERT INTO pet_equipment (user_id, pet_id, slot, accessory_id)
        VALUES (v_claimer_id, v_link.pet_id, v_slot, v_accessory)
        ON CONFLICT (user_id, pet_id, slot) DO UPDATE
          SET accessory_id = EXCLUDED.accessory_id, equipped = true;
      END IF;
    END LOOP;
  END IF;

  UPDATE pet_gift_links
  SET claimed_by = v_claimer_id, claimed_at = now()
  WHERE token = p_token;

  INSERT INTO pet_gifts (sender_id, recipient_id, pet_id)
  VALUES (v_link.sender_id, v_claimer_id, v_link.pet_id)
  ON CONFLICT DO NOTHING;

  RETURN json_build_object(
    'success', true,
    'pet_id', v_link.pet_id,
    'accessories', COALESCE(v_link.accessories, ARRAY[]::text[])
  );
END;
$$;

GRANT EXECUTE ON FUNCTION claim_gift_link(text) TO authenticated;

-- 5. Preview RPC — returns pet id, accessories, sender username, status.
--    Used by the /gift page before login to render the unbox scene.
CREATE OR REPLACE FUNCTION get_gift_link_preview(p_token text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link pet_gift_links%ROWTYPE;
  v_sender_name text;
BEGIN
  SELECT * INTO v_link FROM pet_gift_links WHERE token = p_token LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  SELECT COALESCE(username, display_name) INTO v_sender_name
  FROM profiles
  WHERE user_id = v_link.sender_id
  LIMIT 1;

  RETURN json_build_object(
    'pet_id', v_link.pet_id,
    'accessories', COALESCE(v_link.accessories, ARRAY[]::text[]),
    'sender_username', v_sender_name,
    'claimed', v_link.claimed_by IS NOT NULL,
    'expired', v_link.expires_at < now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_gift_link_preview(text) TO anon, authenticated;

-- Force PostgREST to reload its schema cache so the new function signature
-- is visible to the app immediately.
NOTIFY pgrst, 'reload schema';
