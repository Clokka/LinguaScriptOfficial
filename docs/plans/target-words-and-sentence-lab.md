# Target words, chunks and the Sentence Lab

The product decisions behind LinguaScript's next learning loop. **Any agent
working on target words, chunks, line clears, flashcard ordering or the
Sentence Lab must read this first.** It records what the product owner
decided, and why, so work doesn't drift back to rejected ideas.

Status: agreed plan. Data foundations are built (see "What exists"); the
features below are not built yet unless marked.

---

## 1. Principles (non-negotiable)

1. **Frequency first.** How common a word or phrase is in real speech decides
   what gets taught. Research: frequency is the strongest predictor of
   usefulness; ~3,000 word families cover ~95% of film/TV speech (Webb &
   Rodgers 2009; Nation 2006).
2. **One word family = one word.** "mange", "manges", "mangé" all count as
   "manger" for frequency, known-status and suggestions.
3. **Chunks over lone words.** Tiny grammar words (de, le, que, en) are
   **never** taught alone, only inside chunks ("il y a", "j'ai besoin de",
   "en train de"). A phrase is taught only if it is as common as the words it
   competes with. Frequent collocations ("faire attention", "avoir faim") get a
   small bonus. (Lewis, Lexical Approach; Martinez & Schmitt 2012.)
4. **Dopamine through rarity and play.** Rewards must be earned and not
   constant. Few highlighted items, satisfying snaps, one big celebration.
5. **Fast Track uses frequency lists; CEFR mode uses real CEFR lists** where
   licensed (CEFR-J + Octanove for English now; FLELex for French pending
   permission), falling back to frequency. Store where a level came from.

## 2. Colour system (must match website, extension and brand/README.md)

| Colour | Meaning |
|---|---|
| White | Not met yet |
| **Cyan** | Today's **target word**: "learn me!" (a filled tile, not only text colour) |
| **Purple** | Target **phrase/chunk**: one connected tile across the words, like a Tetris piece |
| Red `#FF3B30` | Saved, new |
| Orange `#FF8A00` | Learning |
| Green `#34C759` | Known |
| Grey | Names, numbers, sounds (euh, ah): ignored everywhere |
| Gold | **On hold.** Do not build new gold features. |

Existing red/orange words stay red/orange. Cyan and purple are **added** on top
for the day's targets only.

## 3. The daily loop (Warmer, then Body, then Plenary)

The goal: get the learner to hit **their** daily goal (N = daily word goal, e.g. 8
or 1) and come back tomorrow. That is the whole point.

- **Picker:** per video, one ranked list of words and chunks (frequency first,
  see section 5). N counts what's *left* of today's goal (added 5 of 8, so the next video
  suggests 3). A chunk counts as 1. Excludes anything green or already in the deck.
  Short videos: show fewer rather than padding with bad items.
- **Warmer (about 20 s, skippable):** "Your target words for today" as cyan/purple
  tiles with meaning and tap-to-hear, plus a goal ring (0/8). Pre-teaching before
  listening is standard EFL practice.
- **Body (video):** target items glow cyan/purple. Tapping one and adding it
  turns it red (a Tetris-style "landing"), fills the ring and makes the chameleon react.
- **Plenary:** recap, an "Add the rest" button, **8/8 = big celebration**
  (chameleon dance, confetti, streak +1), then "Come back tomorrow to review".
- Cyan words are **not** auto-added to flashcards; the learner adds them (the tap
  is the reward moment).
- Reviewing yesterday's words is part of the daily goal and streak (adding
  isn't learning).
- **Guests:** everything works in browser storage. The first time a guest hits
  8/8, show "Save your progress! Create a free account so you don't lose
  your 8 words."

## 4. Line clears

- **Only the Perfect Clear** (every word green) blasts. There are no red or orange clears.
- Cyan does **not** count as coloured until tapped.
- Grey words are ignored when checking a line.
- At most one clear per line (no XP farming by rewatching).
- Reduced motion (prefersReducedMotion) turns the blast into a glow; build later.

## 5. Scoring (the word picker)

One shared scoring function, used by the picker, flashcard ordering and the
Sentence Lab:

- frequency of the **word family** (log rank), the main factor
- chunk bonus when the phrase is frequent; small collocation bonus
- repeats in this video
- common in the learner's own videos/interests
- learnability (cognates)
- CEFR mode only: own level first, then +1; +2 only if frequent, a chunk or repeated
- the AI may choose among the top ~20 so the N items **fit together into a
  sentence** (a tie-breaker only; never swap a frequent item for a rare one).
  Avoid sets of near-synonyms or one category (e.g. 8 fruits), which cause interference.

Flashcards: **new** cards in score order; **due** review cards keep due-date
order (don't break spaced repetition).

## 6. Sentence Lab (replaces the old LinguaScripts)

Old LinguaScripts (/linguascript, "352 ready for review") is retired: it drilled
fragments ("s'en", "partent") and showed overwhelming totals. Hide its entry
points; **do not delete its tables or data.**

**Mechanic (Presentation, then Practice, then Production).** A board shows a **frame**
with a gap, e.g. `[J'ai besoin de] [ ___ ]`. Below it are 3–5 draggable **blocks** made
from the learner's green words (at most one orange). Drop a block in the gap: correct means the line snaps and
**blasts** (reuse lineBlast.ts); wrong means the block wobbles back with a hint.

- Frames: `core_phrases` (kind = 'frame'), falling back to `sentence_patterns`.
- A session is 5 boards (about 3 minutes), with a combo multiplier and chameleon reactions.
- Never show scary totals ("352 due"); show "Today: 5 boards · ~3 min".
- Optional after onboarding (not in onboarding). Pro; free users get 1 board a day.
- Mobile first. Colour-blind safe (shape + colour).
- Later: AI example sentences built only from the learner's green words plus the
  new chunk, generated once per chunk and shared (cheap), with the top 200
  checked by a native speaker.

### Answer checking and hints (important)

Hints must say **what actually went wrong**, never a generic "try a verb".
A slot can accept more than one kind of word: "j'ai besoin de ___" takes a verb
(dormir) **or** a noun (aide).

1. **Accept every valid answer.** Each frame's slot has a list of accepted
   word types (from the frame's real fillers + `core_vocabulary.pos`). Any
   block that fits the type and makes sense is correct, not only the intended one.
2. **Rules first, AI only when unsure.** Check type by rules; only if the type
   fits but it's unclear whether the meaning works, ask AI (cache the answer).
3. **Hint ladder (specific, kind, short):**
   - Wrong **kind** of word: name what the gap takes, from the slot's accepted
     types: "This gap needs an action (like *dormir*) or a thing (like *aide*)."
   - Right kind, **meaning** doesn't fit: show the frame's meaning: "J'ai besoin
     de ___ = I need ___. Which one do you need?"
   - Right word, wrong **form** (agreement/ending, e.g. *désolé/désolée*):
     "So close! Check the ending."
   - After 2 misses: gently highlight the right block. No penalty except the
     combo resets. Never shame.

## 7. What exists already

- `src/lib/phraseFrames.ts`: tokenizer, n-grams with range, MI, phrase-frames
- `scripts/phrases/antconc.ts`: AntConc-style finder over subtitle folders or the DB
- `data/fr/`: word families, scored chunks and frames for review (see its README)
- Migration `20260925090000_core_phrases_and_word_families.sql`: `core_phrases`,
  `core_vocabulary.family*`. Loaders: `scripts/seed-core-phrases.ts`,
  `scripts/apply-word-families.ts`
- Reusable UI: `GapFillChallenge.tsx`, `blocks/WordBlock.tsx`, `lineBlast.ts`,
  `LineBlastOverlay.tsx`, `ChameleonReaction.tsx`, `sentencePatterns.ts`

## 8. Rejected ideas (don't reintroduce)

- Gold for words "1–2 CEFR levels above you" (not pedagogically sound; reverted).
- Red/orange line clears (reward saving, not learning).
- Auto-adding target words to flashcards.
- Letting the AI pick words freely without frequency data.
- Video audio clips on flashcards (too costly for now; maybe later).
