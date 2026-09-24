# Fix: onboarding demo video errors and missing intro videos

## What's going wrong

1. **The "video missing from catalogue, ask an admin to add it" error.** The demo button only has a YouTube ID for each language. It then looks in your video library for a video with that ID. If it can't find one, it tries any public video in that language, and if that fails too it shows the error. For French, Japanese, Spanish, Italian, German and Portuguese, the intro videos were never added to the library, so the lookup finds nothing.
2. **Signed-out visitors can't see the library.** Many people reach this step before signing up. If the library can't be read by visitors, the lookup fails even when the video is there.
3. **Some languages have no intro video at all.** Chinese, Korean, Arabic, Hindi, Thai, Russian, Turkish, Dutch, Polish, Swedish and English have no video listed.
4. **The backend is not responding right now.** Any lookup fails while it's down. That makes the error show up even more often.

## The fix

- **Add the intro videos to the library automatically.** If the intro video isn't in the library yet, the demo adds it on the spot, with its subtitles, the same way pasting a YouTube link works. No admin step is needed.
- **Let visitors see intro videos.** Mark all intro videos as public so they load before sign-up.
- **Cover every language.** Find a short, beginner-friendly video with captions for each of the 11 missing languages. I'll check that each one really is in that language, then send you the list to approve before it goes live. Chinese will come first.
- **Admin "Intro videos" panel.** One row per language showing whether its video is present and working. You can swap in a new video by pasting a link, with no code change.
- **Never show a dead end.** If a video still can't load, go to the guided demo using any video in that language, or skip ahead with a friendly note. The "ask an admin" message will be removed.

## Technical notes

- `src/pages/Onboarding.tsx` (`enterDemo`, around line 447): if the lookup finds nothing, call the existing fetch-captions ingestion to insert the film (`is_public = true`, `language = target`), then continue. Replace the toast with the fallback.
- Move `TOUR_TRAINING_BY_LANG` into a new `tour_intro_videos(language pk, youtube_id, film_id)` table: anon SELECT, admin write, with grants. Keep the code map as a seed and offline fallback.
- Check the `films` RLS policy for anon SELECT on `is_public`.
- Backend: it's currently unreachable. Restart it first, then re-run the audit query to confirm which intro films exist.
