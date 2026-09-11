-- Security fix: profiles' UPDATE RLS policy (from
-- 20260327143822_b1e79336-d9d0-436d-9263-0419e572f5e8.sql) only restricts
-- WHICH ROW can be updated (auth.uid() = user_id) — it has no WITH CHECK
-- narrowing WHICH COLUMNS a user may change on their own row. Any
-- authenticated user can currently call
--   supabase.from('profiles').update({ is_pro: true, pro_source: 'admin_grant' })
-- directly against the REST API and grant themselves Pro for free, with no
-- payment and no admin action involved.
--
-- Fixed with a BEFORE UPDATE trigger rather than a tighter RLS policy,
-- because column-level restriction isn't expressible in a USING/WITH CHECK
-- clause — those only see whole-row predicates. The trigger reverts the
-- five Pro-tracking columns to their previous values unless the caller is
-- the service role (the Stripe webhook's sync_pro_from_subscription path)
-- or already holds the admin role (admin_grant_pro/admin_revoke_pro check
-- this themselves too; the trigger check is redundant defense-in-depth,
-- not a replacement for it) — every other column on the row (display_name,
-- interests, onboarded, show_on_global_leaderboard, etc.) is left alone, so
-- a user's legitimate profile edits in the same request are unaffected.
CREATE OR REPLACE FUNCTION public.protect_profile_pro_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  NEW.is_pro := OLD.is_pro;
  NEW.pro_source := OLD.pro_source;
  NEW.pro_expires_at := OLD.pro_expires_at;
  NEW.pro_granted_at := OLD.pro_granted_at;
  NEW.pro_granted_by := OLD.pro_granted_by;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_pro_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_pro_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_pro_fields();
