-- The mascot is now called "Chameleon" everywhere, and its pet id changed
-- from 'felix' to 'chameleon'. That id is persisted, so without this migration
-- every learner who owns or has equipped the chameleon would silently lose it.

-- pet_collection is UNIQUE(user_id, pet_id): if a row for the new id somehow
-- already exists, drop the old one instead of colliding on the rename.
DELETE FROM public.pet_collection AS old
 USING public.pet_collection AS existing
 WHERE old.pet_id = 'felix'
   AND existing.pet_id = 'chameleon'
   AND existing.user_id = old.user_id;

UPDATE public.pet_collection
   SET pet_id = 'chameleon'
 WHERE pet_id = 'felix';

UPDATE public.profiles
   SET active_pet = 'chameleon'
 WHERE active_pet = 'felix';

-- Gift log is historical, but keep it consistent so the UI can resolve names.
UPDATE public.pet_gifts
   SET pet_id = 'chameleon'
 WHERE pet_id = 'felix';
