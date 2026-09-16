# Chameleon sizing, per-language separation, honest emails, word-list coverage

## What I found

**1. Level-up chameleon**
The celebration draws the 3D pet into a square canvas whose render buffer is 220px, but the on-screen frame is 190px on phones and 220px on desktop, and the model is fitted to fill 1.5 units of a camera sitting close in. The result: the pet renders larger than its frame and the head/tail clip at the edges. The word-saved toast uses a 150px buffer in a 150px frame, so it stays correct — that one is fine and should not change.
Fix: make the render buffer match the presentation box exactly and pull the model fit back so the whole pet, including its tail, sits inside the frame with breathing room. No change to timing, clips, confetti, the level text, or the model-cloning fix.

**2. Emails claiming thousands of words to review — root cause found**
When someone picks a level during onboarding, the app marks that level's vocabulary as already known by writing one saved word row per word, in the green deck, with a review date in the past. One French account alone has 17,632 green rows, all technically "due".
The review email counts every saved word whose review date has passed, across every language, ignoring the deck. So it reports ~19,000 "cards to review" for a learner who really has a few hundred.
Fix (three parts):
- Count only red and orange words, only in the learner's current language.
- Cap the number shown at a believable session size (say 30) and phrase it as "you have X waiting" rather than a raw total.
- Stop seeded known-vocabulary from ever looking due: give green seeded rows a far-future review date so no query, email or screen can mistake them for work.

**3. Per-language separation**
Saved words, exercises and comprehension already carry a language and the screens filter by it, so flashcards and exercises are separated today. What is not separated:
- Review, weekly and monthly emails count across all languages at once.
- The streak, daily goals and XP are one global number rather than per language, while the language profile table already has its own goal fields going unused.
- Progress counters on the home screen mix languages in places.
Fix: make the learner's active language the single filter for every count that reaches them — emails, goals, streak text and progress — and read daily goals from the per-language profile rather than the global profile. Colour coding is already identical by design across languages and stays that way.

**4. Word lists — coverage audit**
Frequency and CEFR-banded lists exist for six languages only: French, Spanish, Italian, German, Russian (3,000 words each) and Portuguese (4,986). Every list stops at rank 3,000–5,000, which covers A1–B1 and part of B2; C1 needs 9,000 and C2 needs 16,000, so the upper levels are currently unbacked.
Eleven offered languages have no list at all: English, Chinese, Japanese, Korean, Arabic, Hindi, Thai, Turkish, Dutch, Polish, Swedish.
Fix: the repo already has a loader that pulls open subtitle-frequency data for 60+ languages. Run it to fill all seventeen languages to 20,000 ranked words with CEFR bands, and until a language has a list, stop offering exam-track and level seeding for it so we never sell a level we cannot back.

## Order of work

1. Chameleon sizing (small, visual, immediate).
2. Email honesty: language filter, red/orange only, capped phrasing.
3. Seeded known words made permanently not-due, with a one-time cleanup of existing rows.
4. Per-language goals, streak and progress counts.
5. Word-list backfill for all languages, plus gating levels for languages without data.

## Technical notes

- `src/components/pets/PetCelebration.tsx`: `canvasSize` 220 → match the 190/220 responsive box; loosen `fitModel`'s `1.5 / maxDimension` fit factor. Word-saved stage (150) untouched.
- `supabase/functions/dispatch-retention-emails/index.ts`: due query gains `.eq('language', profile.learning_language)` and `.in('state', ['red','orange'])`, result clamped for display; same language filter for the weekly/monthly word counts.
- Migration: `seed_known_vocabulary` writes `next_review = 'infinity'`-style far date for green seeds; backfill existing green seeded rows.
- Goals read from `language_profiles.daily_word_goal` / `daily_video_goal` for the active language, falling back to `profiles` values.
- `scripts/seed-core-vocabulary.ts` run for all 17 codes; add a guard so exam track only appears where `core_vocabulary` has rows.
