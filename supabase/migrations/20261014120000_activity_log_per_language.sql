-- Daily activity per language: one activity_log row per (user, day, language),
-- so minutes watched, words reviewed and "goal met" in Chinese don't count
-- for Japanese. The streak stays account-wide (profiles.streak_count); the
-- calendars merge a day's rows across languages.

ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT '';

-- Existing rows belong to the learner's main learning language.
UPDATE public.activity_log a
SET language = lower(coalesce(p.learning_language, ''))
FROM public.profiles p
WHERE p.user_id = a.user_id AND a.language = '';

-- Replace the one-row-per-day rule with one row per day per language.
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    WHERE con.conrelid = 'public.activity_log'::regclass
      AND con.contype = 'u'
      AND (SELECT array_agg(att.attname::text ORDER BY att.attname)
           FROM unnest(con.conkey) k JOIN pg_attribute att
             ON att.attrelid = con.conrelid AND att.attnum = k) = ARRAY['date', 'user_id']
  LOOP
    EXECUTE format('ALTER TABLE public.activity_log DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS activity_log_user_date_language_key
  ON public.activity_log (user_id, date, language);
