CREATE OR REPLACE FUNCTION public.reset_to_absolute_beginner(_language text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  removed integer := 0;
  lang text := lower(coalesce(_language, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- Only words pre-marked as known from a starting level: green, parked
  -- forever, never reviewed. Words the learner saved/reviewed are kept.
  WITH del AS (
    DELETE FROM public.saved_words
    WHERE user_id = auth.uid()
      AND lower(language) = lang
      AND state = 'green'
      AND next_review = DATE '2999-01-01'
      AND coalesce(review_count, 0) = 0
    RETURNING 1
  )
  SELECT count(*) INTO removed FROM del;

  UPDATE public.language_profiles
     SET cefr_level = 'a1', seeded_level = NULL, seeded_mode = NULL, updated_at = now()
   WHERE user_id = auth.uid() AND language = lang;

  UPDATE public.profiles
     SET cef_level = 'a1'
   WHERE user_id = auth.uid() AND lower(coalesce(learning_language, '')) = lang;

  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_to_absolute_beginner(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.reset_to_absolute_beginner(text) TO authenticated;