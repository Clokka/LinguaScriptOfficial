# LinguaScripts: honest audit, fixes to make it teach, and a new page design

## Honest audit: does it teach?

Partly. The core idea is sound: you meet a saved word in a new sentence, then pull it back from memory. That fits how memory research says words stick (retrieval practice plus varied context). But five things weaken it right now:

1. **The page gives away the answers.** Before you press Start, the list shows each word ("le message"), the gapped sentence, and the English. You read the answer and then "recall" it seconds later. That's copying, not remembering.
2. **No real spacing.** Getting a card right once marks it done forever. It doesn't come back in 3, 7 or 21 days. Real spaced repetition needs those return visits, and that's where most long-term memory comes from.
3. **It doesn't follow the frequency ladder.** Cards come in date order, not "top 50 first, then 100". That goes against the new LinguaScript direction.
4. **One kind of exercise.** It's mostly fill-the-gap. Learners never hear the word, never produce their own sentence, and never meet it in a second context.
5. **Mismatched colours and labels.** Orange cards are labelled "Learn", red ones "Master" (backwards), and there's an orange title, a yellow-to-green button, and blue numbers. It doesn't match your green-and-white look.

## What to change so it teaches

- **Hide answers before the session.** The page shows only the count, your progress and which ladder milestone the words belong to. No words, sentences or translations.
- **Real review timing.** A correct answer moves the card back 1 → 3 → 7 → 21 → 60 days. A wrong answer brings it back tomorrow. A hint counts as half-right. Red → orange → green follows the same steps, keeping the rule that one correct review moves orange to green.
- **Frequency first.** Inside the daily limit (your word goal), words from your current milestone (for example the top 150) come first, then the rest.
- **Three quick steps per word, in this order:** hear it and pick its meaning (recognise) → fill the gap in a new sentence (recall) → type it from the English alone (produce). Hints turn the chameleon orange, same as now.
- **Fresh sentence each review.** A returning word gets a new sentence so you learn the word, not one memorised line.

## New page design (matches the green-and-white card)

```text
[<-]  LinguaScripts                     
      Top 150 words · French            

+-------------------------------------+
|  LINGUASCRIPTS (green label)        |
|  5 words to review today            |
|  ====------  0 / 5 done             |
|  [      Start review  ->     ] green|
+-------------------------------------+

 Coming back soon
 Tomorrow 3 · This week 12   (numbers only)

 Your decks   (red) 4  (orange) 9  (green) 120
```

- One green card, not three stat boxes. The "Completed today" number becomes a progress bar.
- One full-width green button, no gradient.
- Deck counts use the real red, orange and green deck colours, with matching labels (New / Learning / Known).
- Done state: green tick, "All done for today. Come back tomorrow", plus a "Watch a video" button.
- Empty state: "Save words while watching to start" with a green button.
- The session screens get the same dark background, green buttons, and deck colours only.

## Technical details

- `src/pages/LinguaScripts.tsx`: rebuild the layout. Drop the exercise list. Add upcoming counts (scheduled_for tomorrow / within 7 days), deck counts from `saved_words` in the active language, and the current milestone from the `frequency_coverage` RPC. Use `DECK` from `deck-colors.ts` and replace slate/amber/blue hardcoded colours with tokens.
- Sort the queue by `frequency_rank` of the matching saved word (current band first), then `scheduled_for`. Still capped at goal minus done today.
- `recordLinguaScriptCompletion`: instead of permanently closing the row, set the next `scheduled_for` from an interval step stored in `linguascripts.stage` (reusing the unused column). Wrong → stage 0, tomorrow. Remove the `completed_at` permanent close, or insert a follow-up row. The "done today" count uses a new `last_reviewed_at` column (migration).
- Session order in `LinguaScriptSession.tsx`: recognise (listen + MCQ) → gap-fill → active recall.
- A new sentence on re-review via `generateLinguaScriptFromWord` when stage ≥ 2.
- Rename the mislabelled states in `STATE_CONFIG`.

## Order of work
1. Page redesign + hide answers (quick, visible).
2. Real review timing + frequency ordering.
3. Three-step session + fresh sentences.
