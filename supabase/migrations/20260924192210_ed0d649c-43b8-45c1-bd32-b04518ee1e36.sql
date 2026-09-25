UPDATE public.films SET is_public = true WHERE url LIKE '%bRecoD9OsaM%';
INSERT INTO public.films (title, url, thumbnail_url, language, is_public, cefr_level, category, duration_seconds)
SELECT v.title, 'https://www.youtube.com/watch?v='||v.id, 'https://i.ytimg.com/vi/'||v.id||'/hqdefault.jpg', v.lang, true, 'A1', 'intro', v.dur
FROM (VALUES
 ('zh','WjvTAyUc9ro','Super Beginner Chinese – Comprehensible Input',676),
 ('ko','9lOJxJBRj1I','Comprehensible Korean Input for Beginners',334),
 ('ar','f47iF_Ykd-8','Beginner Arabic Story – Easy Arabic',490),
 ('hi','lbsQJghnHdU','Slow Hindi Listening Practice',970),
 ('th','aNdYdSpL6zE','Learn Thai in Thai: Absolute Beginner Baby Steps',599),
 ('ru','Dlo4pxB2WUg','Story of Alexey – Beginner Russian Comprehensible Input',641),
 ('tr','ytwfWa1KUyY','Easy Turkish Dialogs for Beginners',387),
 ('nl','StLd7rw1BfI','Tidying up the Kitchen – Beginner Dutch Comprehensible Input',844),
 ('pl','KfbaaG5KdKg','Learn Polish with a Short Story – Beginners',603),
 ('sv','VY24C7Bs3OM','Beginner Swedish: Ansiktet (The Face)',364),
 ('en','31AtaK035JQ','Very Easy English Story for Total Beginners',402)
) AS v(lang,id,title,dur)
WHERE NOT EXISTS (SELECT 1 FROM public.films f WHERE f.url LIKE '%'||v.id||'%');