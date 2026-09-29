# LinguaScripts effectiveness audit + restore "Most common words" card

## Honest audit (from your screenshots)

What's working: the home card, daily cap, listen-first step and "coming back soon" are all good.

What still undermines learning:
1. **Broken answer choices.** The fill-the-gap board shows "pas, pas, pas, test, que". Three copies of the right answer plus a junk word means the learner can't get it wrong, so the step tests nothing.
2. **Bad sentences.** "mademoiselle bertignac je ne vois pas" is a scrap of subtitle with a character's name in it. It's not a clean example sentence for the word.
3. **Words taught one at a time when they belong together.** "ne" and "pas" are shown as two separate words. In French they work as one pair ("ne … pas"), so they should be taught together.
4. **The "write a sentence" step is too hard and off-style.** It asks for 5 free sentences in one go, then grades them all at once ("Evaluate All"). That's the hardest task, it comes with no support, and it still uses the old dark slate/yellow look.
5. **No sign of progress up the ladder.** The header says "Top 800 words", but the session never says "this word moves you closer to the top 850".

## Fixes to LinguaScripts

- **Answer choices:** always 4 different options. The right word plus 3 real, common words of the same type from your current frequency band. No duplicates and no placeholder words like "test".
- **Sentences:** use a short, clean sentence (5–10 words) written for that word at your level. Skip subtitle lines that contain names or are cut off. Fall back to the sentence written for the word.
- **Word pairs:** words that belong together (ne…pas, il y a, est-ce que) are taught and checked as one item.
- **Order per word:** listen → pick meaning → fill the gap → pick the right form (only for words you already know) → a single short sentence of your own, with the word's example shown as a model. One word per screen, marked straight away, instead of 5 boxes at the end.
- **Restyle:** the writing step and the rest of the session move to the green/white look. The old slate/amber colours and "Evaluate All" button go.
- **Ladder feedback:** the end screen says "3 more words to reach the top 850".

## Restore the "Most common words" card (your 4th screenshot)

The card goes back to the exact layout you liked, on both the Vocabulary page and the Comprehension/Progress page:

- Small label: MOST COMMON WORDS
- Headline: "You know **94%** of the **50** most important French words" (green %)
- Line: "47 / 50 known · next milestone: top 100"
- Green progress bar
- Text: "These are the words that appear most often in real speech — learning them in order is the fastest route to understanding what you watch."
- Green "Study these words →" button
- At 3,000: "French complete — you know the 3,000 most common words."

**The honest number:** the milestone will count only words you've actually learned (saved and reviewed). Words assumed from the level you picked at sign-up won't count. That's why the card jumped you to "top 1,000" before. You'll see real progress from top 50 → 100 → 150 … → 3,000, and the ladder, the deck and LinguaScripts all use the same count.

A second small line shows the full picture: "plus 997 words assumed from your level".

## Technical details

- `frequency_coverage` RPC: exclude seeded greens (`next_review >= '2999-01-01'`) from `known`. Return a separate `assumed` count.
- `FrequencyCoverageCard`: restore the screenshot-4 layout and copy. Mount it in `Vocabulary.tsx` and in the Comprehension/Progress page (`ProgressDashboard`).
- `CommonWordsDeck` and the LinguaScripts header use the same headline band.
- `sentenceLabBoard` / gap options: dedupe, drop non-vocabulary tokens, pick distractors from `core_vocabulary` in the same band and part of speech.
- Sentence choice: reject contexts that contain proper nouns (capitalised mid-sentence), are under 4 or over 12 tokens, or don't contain the target word. Otherwise call `generate-linguascript`.
- A multi-word unit table for common pairs per language (seeded for fr/es/it/de/pt).
- Replace the batch "write sentences" screen with a per-word production step inside `LinguaScriptSession`, using theme tokens.
