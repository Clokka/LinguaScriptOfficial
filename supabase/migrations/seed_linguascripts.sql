-- Phase 0: Seed test data for LinguaScripts
-- Run this after create_linguascripts_system.sql

-- Get the current authenticated user's ID (you'll need to replace this manually)
-- In production, get your user ID from the profiles table:
-- SELECT id FROM public.profiles LIMIT 1;

-- For testing: Insert sample LinguaScripts for the first user
-- You'll need to replace 'YOUR_USER_ID' with an actual user ID from your database

DO $$
DECLARE
  test_user_id uuid;
BEGIN
  -- Get first user for seeding
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;

  IF test_user_id IS NOT NULL THEN
    -- Sample 1: Gap-Fill Exercise
    INSERT INTO public.linguascripts (
      user_id,
      language,
      target_word,
      sentence,
      translation,
      interest,
      gap_position,
      gap_options,
      mcq_options,
      status
    ) VALUES (
      test_user_id,
      'fr',
      'remplir',
      'Je voudrais remplir cette bouteille d''eau.',
      'I would like to fill this water bottle.',
      'everyday',
      2,
      '{"correct":"remplir","distractors":["donner","prendre","mettre"]}',
      '{"correct":0,"options":["remplir","donner","prendre","mettre"]}',
      'pending'
    );

    -- Sample 2: Restaurant context
    INSERT INTO public.linguascripts (
      user_id,
      language,
      target_word,
      sentence,
      translation,
      interest,
      gap_position,
      gap_options,
      mcq_options,
      status
    ) VALUES (
      test_user_id,
      'fr',
      'commander',
      'Je voudrais commander une salade, s''il vous plaît.',
      'I would like to order a salad, please.',
      'dining',
      2,
      '{"correct":"commander","distractors":["manger","goûter","servir"]}',
      '{"correct":0,"options":["commander","manger","goûter","servir"]}',
      'pending'
    );

    -- Sample 3: Travel context
    INSERT INTO public.linguascripts (
      user_id,
      language,
      target_word,
      sentence,
      translation,
      interest,
      gap_position,
      gap_options,
      mcq_options,
      status
    ) VALUES (
      test_user_id,
      'fr',
      'arriver',
      'Le train arrive à Paris à 18 heures.',
      'The train arrives in Paris at 6 PM.',
      'travel',
      1,
      '{"correct":"arrive","distractors":["part","attends","continue"]}',
      '{"correct":0,"options":["arrive","part","attends","continue"]}',
      'pending'
    );

    -- Sample 4: Learning context (already completed)
    INSERT INTO public.linguascripts (
      user_id,
      language,
      target_word,
      sentence,
      translation,
      interest,
      gap_position,
      gap_options,
      mcq_options,
      status,
      correct,
      gap_answer,
      completed_at,
      combo_multiplier,
      xp_earned
    ) VALUES (
      test_user_id,
      'fr',
      'apprendre',
      'Je veux apprendre le français rapidement.',
      'I want to learn French quickly.',
      'learning',
      2,
      '{"correct":"apprendre","distractors":["enseigner","comprendre","étudier"]}',
      '{"correct":0,"options":["apprendre","enseigner","comprendre","étudier"]}',
      'completed',
      true,
      'apprendre',
      now(),
      1,
      15
    );

    -- Sample 5: Sports context
    INSERT INTO public.linguascripts (
      user_id,
      language,
      target_word,
      sentence,
      translation,
      interest,
      gap_position,
      gap_options,
      mcq_options,
      status
    ) VALUES (
      test_user_id,
      'fr',
      'jouer',
      'Mon frère aime jouer au football.',
      'My brother likes to play football.',
      'sports',
      2,
      '{"correct":"jouer","distractors":["regarder","faire","commencer"]}',
      '{"correct":0,"options":["jouer","regarder","faire","commencer"]}',
      'pending'
    );

    RAISE NOTICE 'Successfully seeded 5 LinguaScripts for user %', test_user_id;
  ELSE
    RAISE WARNING 'No users found in the database. Create a user first via auth.';
  END IF;
END $$;
