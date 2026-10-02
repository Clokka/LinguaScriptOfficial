# Absolute beginner option in Settings

## Audit
- Onboarding already offers "Total beginner" below A2. Picking it skips pre-marking any words as known, so the Top 50 deck starts from 0.
- Settings (My Languages card on Profile) only lists A1 to C2, in two places: the level picker on each language and the "Add a language" picker. Nobody can choose absolute beginner after onboarding.
- Changing the level in Settings today only changes video recommendations. It never removes the words that were pre-marked as known when you started at a higher level. So moving down to beginner would still leave Top 50 showing as complete.

## What changes
1. Add **"Absolute beginner (below A1)"** as the first choice in both level pickers in My Languages.
2. Adding a new language as absolute beginner works exactly like onboarding: nothing is pre-marked as known, and the decks start at Top 50 with 0 known.
3. Switching an existing language to absolute beginner shows a confirm box: "Start from zero? Words we assumed you knew from your starting level will be removed so you can learn them from the Top 50 deck. Words you've learned yourself are kept."
   - On confirm: only the assumed words for that language are reset. Words you saved or reviewed yourself stay.
   - The decks, the "You know X of the most common words" card and the daily goal all update to match.
4. Choosing A1 or higher again later works as it does now (it can re-mark that level's words as known).

## Technical details
- Level value: reuse the onboarding beginner value (`below`, with `seeded_level` set back to NULL). `seedForProfile` already ignores it, and `seed_priority_words` already starts the red queue at rank 1 when `seeded_level` is NULL.
- New security-definer RPC `reset_to_absolute_beginner(_language)`: deletes the caller's saved_words for that language that are seeded (green, parked at next_review 2999-01-01, review_count 0), sets language_profiles.cefr_level='below', seeded_level=NULL, and syncs profiles.cef_level if it's the active language. Then call `topUpPriorityWords`.
- MyLanguagesPanel: add the option to both Selects, the confirm dialog, and `totalBeginner: true` on add. Labels through the existing i18n `totalBeginner` string.
- After reset, clear the cached frequency coverage so the card and decks refresh.
