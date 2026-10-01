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
  IF p_pet_id NOT IN ('chameleon') THEN
    RETURN json_build_object('error', 'This pet is not available as a free gift');
  END IF;
  SELECT * INTO v_existing FROM pet_gift_links
  WHERE claimed_by = v_user_id AND pet_id = p_pet_id AND sender_id IS NULL LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object('ok', true, 'already_claimed', true, 'pet_id', p_pet_id, 'token', v_existing.token);
  END IF;
  INSERT INTO pet_collection (user_id, pet_id, gifted_from)
  VALUES (v_user_id, p_pet_id, NULL)
  ON CONFLICT (user_id, pet_id) DO NOTHING;
  INSERT INTO pet_gift_links (sender_id, pet_id, claimed_by, claimed_at)
  VALUES (NULL, p_pet_id, v_user_id, now())
  RETURNING token INTO v_token;
  RETURN json_build_object('ok', true, 'already_claimed', false, 'pet_id', p_pet_id, 'token', v_token);
END;
$$;
REVOKE EXECUTE ON FUNCTION claim_free_pet(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION claim_free_pet(text) TO authenticated;
NOTIFY pgrst, 'reload schema';