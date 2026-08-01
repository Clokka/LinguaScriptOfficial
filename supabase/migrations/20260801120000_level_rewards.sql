-- Level milestone rewards + Gems currency.
--
-- Gems are a cosmetic-only currency: they unlock pets (see src/lib/pets.ts)
-- and, later, other cosmetics. They must never buy vocabulary, XP boosts or
-- anything that affects learning outcomes.
--
-- Rewards are DETERMINISTIC per level (never random) and granted exactly once
-- per (user, level) via the unique constraint on level_rewards.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gems integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gems_spent integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.level_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level integer NOT NULL CHECK (level >= 2),
  gems integer NOT NULL DEFAULT 0,
  granted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, level)
);

CREATE INDEX IF NOT EXISTS level_rewards_user_idx
  ON public.level_rewards (user_id);

ALTER TABLE public.level_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own level rewards" ON public.level_rewards;
CREATE POLICY "Users read own level rewards" ON public.level_rewards
  FOR SELECT USING (auth.uid() = user_id);

-- Writes go through sync_level_rewards() (SECURITY DEFINER) only, so a client
-- cannot mint itself gems by inserting rows directly.

-- Gems granted for reaching a level. Mirrors gemsForLevel() in
-- src/lib/levelRewards.ts — keep the two in sync.
CREATE OR REPLACE FUNCTION public.level_reward_gems(p_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_level < 2 THEN 0
    ELSE 25
       + CASE WHEN p_level % 5  = 0 THEN 100 ELSE 0 END
       + CASE WHEN p_level % 25 = 0 THEN 250 ELSE 0 END
  END;
$$;

-- Grants every unclaimed level reward up to p_level and recomputes the gem
-- balance. Idempotent: calling it repeatedly with the same level is a no-op,
-- so a retry, a page reload or a double-fired level-up cannot double-pay.
-- Returns the caller's new gem balance.
CREATE OR REPLACE FUNCTION public.sync_level_rewards(p_level integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_balance integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN 0;
  END IF;

  -- Guard against a corrupted/hostile level value driving a huge series.
  p_level := LEAST(GREATEST(COALESCE(p_level, 1), 1), 500);

  IF p_level >= 2 THEN
    INSERT INTO public.level_rewards (user_id, level, gems)
    SELECT v_uid, g.n, public.level_reward_gems(g.n)
    FROM generate_series(2, p_level) AS g(n)
    ON CONFLICT (user_id, level) DO NOTHING;
  END IF;

  -- Balance is always derived from the ledger, never incremented in place,
  -- so it self-heals if a grant is ever replayed or rolled back.
  UPDATE public.profiles p
     SET gems = GREATEST(
           0,
           COALESCE((SELECT SUM(r.gems)
                       FROM public.level_rewards r
                      WHERE r.user_id = v_uid), 0)
           - COALESCE(p.gems_spent, 0)
         )
   WHERE p.user_id = v_uid
   RETURNING p.gems INTO v_balance;

  RETURN COALESCE(v_balance, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.sync_level_rewards(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.sync_level_rewards(integer) TO authenticated;
