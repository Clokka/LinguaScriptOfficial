# Green home card, correct-language grading, gold "click me" words, daily level-ups

## 1. Restore the green "Today's goal" card on Home
The goal card (0 / 1 words) went back to the plain grey shell. Restyle it to match the green LinguaScripts card in your screenshot: green border, soft green tint, green "TODAY'S GOAL" label, green number and green progress bar. Same shape as the review card underneath so the two read as one set.

## 2. Writing round graded as French when learning Spanish
Cause found: the AI checker for "Use it" has the word "French" written into its instructions, so a correct Spanish sentence (e.g. with "hay") gets marked wrong and corrected into French.
Fix:
- Send the word's actual language (the video's language) and the learner's first language with every check.
- Checker instructions say "Evaluate this <Spanish> sentence", feedback written in the learner's first language.
- Same audit for every other grading path (gap-fill, dictation accent check, speaking match) so none falls back to French.

## 3. Gold circle on words to click while watching
Today a learner on a 1-word goal can sit through the minute and save nothing.
- Before the video, the existing scan (the "Words to watch for" pre-teach list) already picks the words worth learning, ranked by frequency and level.
- While watching, those picked words get the same gold ring as the demo whenever they appear in the subtitles — a gentle pulse, max 2-3 per line.
- Ring count = the daily word goal (1 goal = 1-2 rings, 5 = ~5-6, 8 = ~8-10), so it's a nudge, not clutter.
- Tapping a ringed word saves it as usual, the ring disappears and counts toward the goal.
- If the minute ends with 0 words saved, the "Daily watch goal done" card asks them to save one ringed word first (with a "Skip today" option, never a hard block).

## 4. Level up every day
Change the levelling so a normal day of goal (save goal words + finish LinguaScripts + watch minutes) always crosses one level:
- Flatten the curve: each level costs roughly what one goal-sized day earns, scaled to the learner's goal (1-word goal still levels daily).
- Hitting the full daily goal awards a "goal bonus" that tops up exactly to the next level if they're short (this bonus already exists in part — make it guarantee the level).
- Each level-up keeps giving the gift box from the reward system, so daily = a daily gift.
- Cap at one guaranteed bonus per day so it can't be farmed; extra effort still earns XP normally.
- Existing learners keep their level (no one goes backwards).

## Technical notes
- Goal card: `src/components/DailyGoalTally.tsx` card variant, using `DECK.green`.
- Grading: `supabase/functions/evaluate-linguascripts` prompt is hard-coded "French"; pass `language` + `nativeLanguage` from `LinguaScriptSession` / `linguaScriptEvaluation.ts`, redeploy.
- Gold ring: reuse the golden styling from `SubtitleOverlay`/`GoldenDust`; feed target words from `preTeachVocab` into the overlay on `Watch.tsx`; watch-gate card checks saved-today.
- Levelling: `xpForLevel` thresholds in `src/lib/xp.ts` and `daily_goal_reached` bonus in `XpContext`; map existing XP so current levels never drop.
