
-- ============ PROFILES: username, friend_code, leaderboard opt-in ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS friend_code TEXT,
  ADD COLUMN IF NOT EXISTS show_on_global_leaderboard BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_friend_code_key
  ON public.profiles (friend_code)
  WHERE friend_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_xp_total_idx
  ON public.profiles (xp_total DESC NULLS LAST);

CREATE OR REPLACE FUNCTION public.gen_friend_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
  attempts INT := 0;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..8 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE friend_code = code);
    attempts := attempts + 1;
    IF attempts > 10 THEN EXIT; END IF;
  END LOOP;
  RETURN code;
END;
$$;

UPDATE public.profiles
   SET friend_code = public.gen_friend_code()
 WHERE friend_code IS NULL;

CREATE OR REPLACE FUNCTION public.ensure_friend_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.friend_code IS NULL THEN
    NEW.friend_code := public.gen_friend_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_friend_code ON public.profiles;
CREATE TRIGGER profiles_ensure_friend_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_friend_code();

-- ============ FRIENDSHIPS TABLE ============
CREATE TABLE IF NOT EXISTS public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT friendships_not_self CHECK (user_id <> friend_id),
  CONSTRAINT friendships_unique UNIQUE (user_id, friend_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;

ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see their own friendships" ON public.friendships;
CREATE POLICY "Users see their own friendships"
  ON public.friendships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users create friendship requests from themselves" ON public.friendships;
CREATE POLICY "Users create friendship requests from themselves"
  ON public.friendships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update their friendships" ON public.friendships;
CREATE POLICY "Users update their friendships"
  ON public.friendships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id)
  WITH CHECK (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "Users delete their friendships" ON public.friendships;
CREATE POLICY "Users delete their friendships"
  ON public.friendships FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP TRIGGER IF EXISTS friendships_updated_at ON public.friendships;
CREATE TRIGGER friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Allow friends to read each other's profile ============
CREATE OR REPLACE FUNCTION public.are_friends(_a UUID, _b UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships
     WHERE status = 'accepted'
       AND ((user_id = _a AND friend_id = _b) OR (user_id = _b AND friend_id = _a))
  );
$$;

DROP POLICY IF EXISTS "Friends can view each other's profile" ON public.profiles;
CREATE POLICY "Friends can view each other's profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.are_friends(auth.uid(), user_id));

-- ============ HELPER RPCs ============
CREATE OR REPLACE FUNCTION public.set_username(_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE cleaned TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  cleaned := lower(trim(_username));
  IF cleaned !~ '^[a-z0-9_]{3,24}$' THEN RAISE EXCEPTION 'invalid_username'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE lower(username) = cleaned AND user_id <> auth.uid()
  ) THEN RAISE EXCEPTION 'username_taken'; END IF;
  UPDATE public.profiles SET username = cleaned WHERE user_id = auth.uid();
  RETURN cleaned;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_friend_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE target_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT user_id INTO target_id
    FROM public.profiles
   WHERE upper(friend_code) = upper(trim(_code))
   LIMIT 1;
  IF target_id IS NULL THEN RAISE EXCEPTION 'unknown_code'; END IF;
  IF target_id = auth.uid() THEN RAISE EXCEPTION 'cannot_friend_self'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
     WHERE user_id = target_id AND friend_id = auth.uid() AND status = 'pending'
  ) THEN
    UPDATE public.friendships SET status = 'accepted'
     WHERE user_id = target_id AND friend_id = auth.uid();
    INSERT INTO public.friendships (user_id, friend_id, status)
      VALUES (auth.uid(), target_id, 'accepted')
      ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted';
    RETURN target_id;
  END IF;

  INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (auth.uid(), target_id, 'pending')
    ON CONFLICT (user_id, friend_id) DO NOTHING;
  RETURN target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(_other UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.friendships SET status = 'accepted'
   WHERE user_id = _other AND friend_id = auth.uid() AND status = 'pending';
  IF NOT FOUND THEN RETURN FALSE; END IF;
  INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (auth.uid(), _other, 'accepted')
    ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted';
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  xp_total INTEGER,
  xp_level INTEGER,
  streak_count INTEGER,
  is_self BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         p.display_name,
         p.username,
         p.avatar_url,
         COALESCE(p.xp_total, 0)::int,
         COALESCE(p.xp_level, 1)::int,
         COALESCE(p.streak_count, 0)::int,
         (p.user_id = auth.uid()) AS is_self
    FROM public.profiles p
   WHERE p.user_id = auth.uid()
      OR p.user_id IN (
           SELECT friend_id FROM public.friendships
            WHERE user_id = auth.uid() AND status = 'accepted'
         )
   ORDER BY COALESCE(p.xp_total, 0) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  username TEXT,
  avatar_url TEXT,
  xp_total INTEGER,
  xp_level INTEGER,
  is_self BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         p.display_name,
         p.username,
         p.avatar_url,
         COALESCE(p.xp_total, 0)::int,
         COALESCE(p.xp_level, 1)::int,
         (p.user_id = auth.uid()) AS is_self
    FROM public.profiles p
   WHERE COALESCE(p.show_on_global_leaderboard, true)
   ORDER BY COALESCE(p.xp_total, 0) DESC
   LIMIT 100;
$$;

GRANT EXECUTE ON FUNCTION public.set_username(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_friend_by_code(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_global_leaderboard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(UUID, UUID) TO authenticated;
