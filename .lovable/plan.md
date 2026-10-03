# Full "Start from zero" reset for a language

## Audit
- The existing "Absolute beginner" option only removes words the app *assumed* you knew from your starting level. Words you saved or reviewed yourself (your ~9,000 green words) stay, so the decks still show as mostly complete. That's why you can't really drop back to beginner.
- Your screenshot is from the live site, which doesn't have the Absolute beginner option yet. It only appears once you publish.

## What changes
1. Under each language in Profile → My Languages, add a small red button: **"Start this language from zero"**.
2. Tapping it opens step 1:
   - Title: "Start [Chinese] from beginner level?"
   - Text: "This permanently deletes every [Chinese] word in your flashcards (all decks: green, orange and red) and resets your level to Absolute beginner. This can't be undone."
   - Buttons: Cancel / **Confirm**
3. Confirm opens step 2 (the double confirm):
   - Title: "Are you really sure?"
   - Text: "You'll lose [9,012] [Chinese] words. Your other languages, XP, streak, gems and pets are not affected."
   - The red **"Yes, delete and start from zero"** button stays greyed out for 3 seconds so it can't be tapped by accident.
4. When it's done: the level shows Absolute beginner, Most common words opens at Top 50 with 0 known, and a message reads "[Chinese] reset. You're starting from the Top 50."

## What's kept
Other languages, XP, level, streak, gems, pets, rewards and watch history.

## Technical details
- New security-definer RPC `full_reset_language(_language text)` returning the removed count, granted to authenticated only. For `auth.uid()` and that language it:
  - deletes linguascript_reviews / linguascripts tied to that language (they reference saved_words)
  - deletes all saved_words for that language
  - sets language_profiles cefr_level='a1' (beginner), seeded_level=NULL, seeded_mode=NULL, and profiles.cef_level when it's the active language
- The client then calls `topUpPriorityWords`, clears the cached frequency coverage, focus-deck and due caches, and refreshes the panel.
- Word count for the step 2 text comes from a count-only query on saved_words.
- UI is in MyLanguagesPanel, using two AlertDialogs, the destructive button style and theme colours.
