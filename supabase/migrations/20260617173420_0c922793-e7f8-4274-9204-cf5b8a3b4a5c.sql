
-- 1. Messages table
CREATE TABLE public.friend_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX friend_messages_recipient_created_idx ON public.friend_messages(recipient_id, created_at DESC);
CREATE INDEX friend_messages_sender_created_idx ON public.friend_messages(sender_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.friend_messages TO authenticated;
GRANT ALL ON public.friend_messages TO service_role;

ALTER TABLE public.friend_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON public.friend_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Senders can insert their own messages"
  ON public.friend_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);

CREATE POLICY "Recipients can mark messages read"
  ON public.friend_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

-- Rate limit trigger
CREATE OR REPLACE FUNCTION public.enforce_message_rate_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  per_pair INT;
  per_day INT;
BEGIN
  SELECT COUNT(*) INTO per_pair
    FROM public.friend_messages
   WHERE sender_id = NEW.sender_id
     AND recipient_id = NEW.recipient_id
     AND created_at > now() - INTERVAL '24 hours';
  IF per_pair >= 5 THEN
    RAISE EXCEPTION 'rate_limit_pair' USING HINT = 'You can send up to 5 messages per person per day.';
  END IF;

  SELECT COUNT(*) INTO per_day
    FROM public.friend_messages
   WHERE sender_id = NEW.sender_id
     AND created_at > now() - INTERVAL '24 hours';
  IF per_day >= 30 THEN
    RAISE EXCEPTION 'rate_limit_daily' USING HINT = 'Daily message limit reached. Try again tomorrow.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER friend_messages_rate_limit
BEFORE INSERT ON public.friend_messages
FOR EACH ROW EXECUTE FUNCTION public.enforce_message_rate_limit();

-- 2. Add friend by user id
CREATE OR REPLACE FUNCTION public.add_friend_by_user_id(_target UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _target IS NULL THEN RAISE EXCEPTION 'unknown_user'; END IF;
  IF _target = auth.uid() THEN RAISE EXCEPTION 'cannot_friend_self'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = _target) THEN
    RAISE EXCEPTION 'unknown_user';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.friendships
     WHERE user_id = _target AND friend_id = auth.uid() AND status = 'pending'
  ) THEN
    UPDATE public.friendships SET status = 'accepted'
     WHERE user_id = _target AND friend_id = auth.uid();
    INSERT INTO public.friendships (user_id, friend_id, status)
      VALUES (auth.uid(), _target, 'accepted')
      ON CONFLICT (user_id, friend_id) DO UPDATE SET status = 'accepted';
    RETURN _target;
  END IF;

  INSERT INTO public.friendships (user_id, friend_id, status)
    VALUES (auth.uid(), _target, 'pending')
    ON CONFLICT (user_id, friend_id) DO NOTHING;
  RETURN _target;
END;
$$;

-- 3. Unread count
CREATE OR REPLACE FUNCTION public.get_unread_message_count()
RETURNS INT
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INT FROM public.friend_messages
   WHERE recipient_id = auth.uid() AND read_at IS NULL;
$$;

-- 4. Sanitize display name in leaderboards (never leak emails)
CREATE OR REPLACE FUNCTION public.safe_display_name(_user_id UUID, _display TEXT, _username TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN _username IS NOT NULL AND _username <> '' THEN _username
    WHEN _display IS NOT NULL AND _display <> '' AND position('@' IN _display) = 0 THEN _display
    ELSE 'Learner #' || upper(substr(md5(_user_id::text), 1, 4))
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_global_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, xp_total integer, xp_level integer, is_self boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         public.safe_display_name(p.user_id, p.display_name, p.username) AS display_name,
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

CREATE OR REPLACE FUNCTION public.get_friends_leaderboard()
RETURNS TABLE(user_id uuid, display_name text, username text, avatar_url text, xp_total integer, xp_level integer, streak_count integer, is_self boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         CASE WHEN p.user_id = auth.uid()
              THEN COALESCE(p.display_name, public.safe_display_name(p.user_id, p.display_name, p.username))
              ELSE public.safe_display_name(p.user_id, p.display_name, p.username)
         END AS display_name,
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
