DELETE FROM public.saved_words sw WHERE sw.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sw.user_id);
DELETE FROM public.school_members sm WHERE sm.user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = sm.user_id);
ALTER TABLE public.saved_words ADD CONSTRAINT saved_words_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.school_members ADD CONSTRAINT school_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;