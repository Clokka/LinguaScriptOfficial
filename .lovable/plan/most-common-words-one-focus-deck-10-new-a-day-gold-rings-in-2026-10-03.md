# Most common words: one focus deck, 10 new a day, gold rings in videos

## Audit (what happens today)

- Decks open one at a time (Top 50 → Top 100 …). Good — keep it.
- Starting a deck adds words to your flashcards in batches of 10, but only when you tap Start. Nothing limits how many per day, and nothing reminds you.
- Video words and deck words land in the same flashcard pile, so the two compete for review time.
- The gold ring in videos only marks the 3 words picked by the pre-video scan. It ignores your current Top 50 deck.
- Your screenshot shows Top 50 at 0/50 on a high level account, which is incorrect. The 0/50 should be 50/50 and the further decks should be also marked complete like 100/100 and more

## Recommendation (what works, nothing flashy)

Keep one "focus deck" (your current Top 50 block) and feed it slowly. This is the standard approach used by Anki and Clozemaster: a small daily dose of new words plus reviews.

1. **10 new words a day, added for you.** The first time you open Flashcards each day, the next 10 unlearned words from your focus deck go into your flashcards on their own. You don't need an import button. If you save a word from a video that is also in the deck, it counts toward the 10, so the two never pile up.
2. **One review pile.** Deck words and video words are reviewed together in the same Flashcards session, with words due today first. Don't add a separate screen.
3. **Gold rings follow the deck.** While watching, words from your focus deck that you haven't learned get the same gold ring from onboarding. The pre-video picks still come first, with at most 3 rings per line, so the subtitles never get crowded. Saving a ringed word adds it to flashcards like normal.
4. **Tick off and move on.** When all 50 are known, the deck gets a tick and a short "Top 50 complete. Top 100 unlocked" message. The next day's 10 words come from the new deck. The rest of the day stays free for videos, so the daily goal isn't doubled.
5. **One line on the decks screen.** Under the "You know X…" card: "Today: 10 new words added · 6 to review", with a single "Review" button.

## What won't change

- Deck unlock order, the coverage rule, the 8-word counter under videos, and the daily level-up.
- No new reward screens or pop-ups apart from the one-line "complete" message.

## Technical details

- `src/lib/focusDeck.ts`: `currentFocusBand()` (uses `unlockedBand`), `topUpDailyNew(userId, lang, 10)`. It inserts red saved_words for the next unlearned core_vocabulary ranks in the band. It counts today's non-seeded saves in the band (created_at ≥ local midnight, next_review < 2999) and inserts only the shortfall. It's idempotent, with a per-day localStorage guard plus the count check.
- Called on Flashcards mount and on CommonWordsDeck mount. CommonWordsDeck shows the "Today" line and the completion message (via a stored last-completed band).
- Watch.tsx: load the focus band's unlearned words once per film language, then merge them into `targetWords` after the pre-teach words. SubtitleOverlay already caps rings at 3 per line.
- New-per-day value is fixed at 10 for now, with no settings change. No schema change.