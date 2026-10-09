# Word counter under the video: "2/8" + Review button

## Audit (what exists today)
- Saving a word while watching already counts toward today's word goal (the same number Home shows).
- When the goal is reached, only a small pop-up appears, and it's easy to miss.
- Nothing under the video shows progress while you watch.

## What learners will see
1. A slim bar under the video: "Words saved 2/8" with a green progress bar and a "Review in Flashcards" button (tappable from the first word).
2. Each saved word makes the number pop, with the usual jingle.
3. At 8/8 the video keeps playing. The bar turns fully green, the text changes to "Goal reached: 8/8 words saved", and the button gets a gentle pulse: "Review your 8 words".
4. Extra words after the goal show as "8/8 +2".
5. Nothing pauses or blocks the video, and the app never sends you to another page unless you tap the button.

## Technical details
- New `WatchWordCounter` component under both player layouts in `src/pages/Watch.tsx`, fed by `useDailyWordGoal` (`savedToday`, `goal`). It matches Home and only counts the language you're learning.
- The button opens `/flashcards?focus=today`, and Flashcards shows words saved today first.
- The existing "Daily goal reached" pop-up is replaced by the bar's goal state.
- Seeded greens never count (already true).
- Copy is translated through the existing app translation.
