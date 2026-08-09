-- Free promotional pet, issued by LinguaScript rather than by another user.
--
-- create_gift_link() can't be reused for this: it requires a sender who owns
-- the pet (it checks pet_collection), and a promotional gift has no owner.
-- This is the system-issued equivalent.
--
-- It still writes a pet_gift_links row — sender_id NULL marks it as
-- system-issued — so the existing admin view (src/components/AdminGiftLinks.tsx,
-- mounted at src/pages/Admin.tsx) lists these alongside user-to-user gifts with
-- no UI change.

CREATE OR REPLACE FUNCTION claim_free_pet(p_pet_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing pet_gift_links%ROWTYPE;
  v_token text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  -- Only pets we actually give away for free. Keeps this from becoming a
  -- back door that grants any pet in the catalogue on request.
  IF p_pet_id NOT IN ('chameleon') THEN
    RETURN json_build_object('error', 'This pet is not available as a free gift');
  END IF;

  -- Idempotent: clicking the button twice, or returning through the auth
  -- redirect, must not mint a second gift row.
  SELECT * INTO v_existing
  FROM pet_gift_links
  WHERE claimed_by = v_user_id
    AND pet_id = p_pet_id
    AND sender_id IS NULL
  LIMIT 1;

  IF FOUND THEN
    RETURN json_build_object(
      'ok', true,
      'already_claimed', true,
      'pet_id', p_pet_id,
      'token', v_existing.token
    );
  END IF;

  -- Grant the pet.
  INSERT INTO pet_collection (user_id, pet_id, gifted_from)
  VALUES (v_user_id, p_pet_id, NULL)
  ON CONFLICT (user_id, pet_id) DO NOTHING;

  -- Record it so admin can see free gifts being claimed.
  INSERT INTO pet_gift_links (sender_id, pet_id, claimed_by, claimed_at)
  VALUES (NULL, p_pet_id, v_user_id, now())
  RETURNING token INTO v_token;

  RETURN json_build_object(
    'ok', true,
    'already_claimed', false,
    'pet_id', p_pet_id,
    'token', v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION claim_free_pet(text) TO authenticated;

-- The insert policy on pet_gift_links requires auth.uid() = sender_id, which a
-- system-issued row (sender_id NULL) can't satisfy. SECURITY DEFINER above
-- bypasses RLS for this function only, so the policy stays strict for
-- everything else.
