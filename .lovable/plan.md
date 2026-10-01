# Frequency decks (50 → 3,000), jingle on every card, "send back down" button

## What I understood
1. **Frequency ladder decks, every language.** Replace the single "3,000 most common words" deck with 60 small decks per language: Top 50, Top 100, Top 150 … Top 3,000. Each deck = the next 50 words by frequency stacked on top of the previous ones. Built from the word list already stored for all 17 languages, ordered by frequency rank.
2. **Comprehension area wording.** Keep the line exactly as on your screenshot: "You know 904 of the 1,000 most common French words" — a word count, not a percentage. Reuse that same screen/card for every language and as the header of the deck picker.
3. **Jingle on every flashcard.** The same "ding" that plays when you save a word from a video plays on every flashcard answer ("Got it" and "Again" — soft ding for "Again").
4. **Send a card back down.** A small button on each card to move it down one deck: Green to Orange, Orange to Red. On green cards it reads "Not sure? Move back to Learning". The card then comes back for review soon.

## Audit findings
- The ladder data already exists: a stored calculation counts known words in steps of 50 up to 3,000 for each language. Today it only drives one card and one deck screen that always opens the "next unfinished" band — you can't pick a deck.
- **Big gap:** in 14 of 17 languages the English meaning is blank for the top 3,000 words (only Portuguese and Russian are filled; French is ~90% blank). Decks would show cards with no answer. This must be fixed first.
- French has only 2,889 words in its top 3,000 ranks (gaps in the list) — the last deck will be slightly short; I'll count by position, not by rank number, so every deck is still 50 words.
- Comprehension card currently says "You know 90% of the 1,000 most important…" — it drifted from your wording.
- Flashcards never play a sound; the ding only lives on the watch and setup screens.
- Cards only ever move forward (by design). Moving down needs a deliberate button, which is fine — it doesn't break the "wrong answers never demote" rule.

## Plan
1. **Fill missing meanings** for the top 3,000 words in all 14 languages using AI, in batches, stored with the word list. Learners with a non-English first language keep getting their own-language meanings where we have them (Hindi now), English otherwise.
2. **Deck picker screen** (Flashcards → Most common words): 60 tiles per language — "Top 50", "Top 100"… each showing known/50 for its new slice, with a green tick when complete. Locked look (not blocked) for decks beyond the next one. Tapping a deck studies the unknown words of that slice in batches of 10, through the normal review flow.
3. **Comprehension card**: wording "You know X of the N most common [Language] words", green number, progress bar, "next: Top N+50", "[Language] complete" at 3,000. Same card on Comprehension, Vocabulary and the top of the deck picker.
4. **Jingle**: play the ding on every flashcard answer in all review screens (respects the existing sound on/off setting).
5. **Move-down button**: small button on the back of orange/green cards; moves the card one deck down, schedules it for review today, short confirmation toast.

## Technical details
- `frequency_coverage` RPC unchanged (already 50-step bands, position-based). New `loadBandSlice(language, band)` fetches positions band-49..band via `core_vocabulary` order by rank with range.
- Meaning fill: one-off script calling the AI gateway, writes `core_vocabulary.translation` via run_sql batches (top 3,000 × 14 langs ≈ 40k rows).
- `CommonWordsDeck.tsx` gets a `?band=` param + grid; `FrequencyCoverageCard.tsx` text change.
- `FlashcardReview.tsx`: `playDing` in handleCorrect/handleIncorrect; new `demoteCard(id)` updating `saved_words.state` one step down with `next_review = today`; `Flashcard.tsx` gets optional `onDemote` prop.
- Mobile app flashcards left as-is unless you want it too.

## Questions for you
- Should later decks be freely open, or must Top 50 be finished before Top 100 unlocks? (Plan: open, but the next one is highlighted.)
