
CREATE OR REPLACE FUNCTION public.log_friendship_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.friendship_events (recipient_id, actor_id, kind)
      VALUES (NEW.friend_id, NEW.user_id, 'request_received');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND COALESCE(OLD.status,'') <> 'accepted' THEN
    -- This row was the pending request: NEW.user_id = original requester, NEW.friend_id = accepter
    INSERT INTO public.friendship_events (recipient_id, actor_id, kind)
      VALUES (NEW.user_id, NEW.friend_id, 'request_accepted');
  END IF;
  RETURN NEW;
END;
$$;
