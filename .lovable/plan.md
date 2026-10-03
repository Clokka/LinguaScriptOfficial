# Word counter under the video: "2/8" → review in Flashcards

## Audit (what exists today)
- Saving a word while watching already counts toward today's word goal (the same number Home shows).
- When the goal is reached, only a small pop-up appears ("Daily goal reached — Review"). It's easy to miss and doesn't stop the video.
- A separate watch-time limit pauses the video after N minutes (N = word goal). It already asks people to save a word if they saved none.
- Nothing under the video shows progress while you watch.

Risks with the idea:
- Forcing a review in the middle of a sentence feels jarring → pause cleanly and show a full-screen card, never jump pages without telling them.
- People who already reviewed today shouldn't be forced again → force only once per day per language.
- Learners with a goal of 1 would be pushed out after one word → that's fine and matches the goal.
- Two "stop" screens (watch time + word goal) could pile up → word goal wins; the watch-time card won't show on top of it.

## What learners will see
1. A slim bar under the video: "Words saved 2/8" with a green progress bar and a "Review in Flashcards" button (always tappable, active from 1 word).
2. Each saved word bumps the number with a small pop and the usual jingle.
3. At 8/8: the video pauses and a full-screen green card appears: "8 words saved — time to lock them in", one main button "Review now" (opens Flashcards with today's new words first) and a small "Finish this video first" that allows a single 2-minute grace, after which it opens Flashcards.
4. After reviewing, coming back to the video, the bar shows "8/8 ✓ Reviewed" and they can keep watching and saving (extra words count as bonus).

## Technical details
- New `WatchWordCounter` component under both player layouts in `src/pages/Watch.tsx`, fed by `useDailyWordGoal` (`savedToday`, `goal`), so it matches Home exactly and stays language-scoped.
- New `WordGoalReviewGate` portal: triggers when `savedToday` crosses `goal`, pauses via `playerRef`, records `ls.wordGoalReview.<lang>.<date>` so it fires once per day; grace timer 120s then `navigate("/flashcards?focus=today")`.
- Flashcards: support `?focus=today` to put words created today first.
- Replace the existing "Daily goal reached" toast with this gate; `WatchGoalGate` skips rendering while the word gate is open.
- Seeded greens never count (already true in `useDailyWordGoal`).
