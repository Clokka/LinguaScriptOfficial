# Frequency-Graded Learning + Sentence Structures

&nbsp;

Objective

&nbsp;

Upgrade LinguaScript's vocabulary system so that frequency determines learning priority, while introducing sentence-pattern learning and a highly visible comprehension progression system.

&nbsp;

The goal is not simply to add frequency metadata.

&nbsp;

The goal is to make learners feel:

&nbsp;

«"I'm gradually unlocking the language."»

&nbsp;

A learner should be able to see that they know an increasing percentage of the most common words and feel motivated to increase that percentage.

&nbsp;

---

&nbsp;

1. Clean Up Core Vocabulary

&nbsp;

The current database already contains 20,000 frequency-ranked words for all 17 supported languages.

&nbsp;

The newer 20,000-word lists have overwritten the previous vocabulary by word, so there are:

&nbsp;

- 0 duplicate words

- 0 duplicate ranks

- 17 languages

- 20,000 words per language

- A1–C2 level bands

- meanings already populated

&nbsp;

There are only 1,172 unused legacy words remaining in French, Portuguese and Russian.

&nbsp;

These are outside the intended top 20,000 and have no "user_vocabulary_state" references.

&nbsp;

Migration

&nbsp;

Delete "core_vocabulary" rows where:

&nbsp;

language IN ('fr', 'pt', 'ru')

AND rank > 20000

&nbsp;

Verify afterward that:

&nbsp;

- every language contains exactly 20,000 words

- there are no duplicate words

- there are no duplicate ranks

- no existing learner vocabulary is affected

&nbsp;

Do not modify or delete any learner's saved vocabulary.

&nbsp;

---

&nbsp;

2. Add Frequency Data to Saved Words

&nbsp;

A saved word should know how common it is.

&nbsp;

Add to "saved_words":

&nbsp;

frequency_rank integer

frequency_level text

&nbsp;

Backfill these fields by matching the saved word against "core_vocabulary" using:

&nbsp;

1. language

2. word

3. dictionary/lemma form where applicable

&nbsp;

If a saved word cannot be matched because it is a:

&nbsp;

- name

- slang term

- typo

- proper noun

- word outside the 20,000-word list

&nbsp;

then:

&nbsp;

frequency_rank = NULL

frequency_level = NULL

&nbsp;

These unmatched words should remain valid saved words and simply sort after ranked vocabulary.

&nbsp;

Add:

&nbsp;

(user_id, language, frequency_rank)

&nbsp;

as an index.

&nbsp;

---

&nbsp;

3. Frequency Must Affect Learning Priority

&nbsp;

Frequency should become part of the learning algorithm.

&nbsp;

When selecting vocabulary for:

&nbsp;

- review

- exercises

- personalized LinguaScripts

- recommended words

&nbsp;

prioritize the most frequent vocabulary the learner does not yet know or is due to review.

&nbsp;

Conceptually:

&nbsp;

highest priority =

most frequent + not yet mastered

&nbsp;

Do not simply sort all saved words by frequency regardless of learning state.

&nbsp;

Learning state still matters.

&nbsp;

A word that is due for review should remain eligible for review.

&nbsp;

Frequency determines which unknown/new vocabulary should be introduced first.

&nbsp;

---

&nbsp;

4. Create a Frequency Comprehension System

&nbsp;

This is an important new product mechanic.

&nbsp;

Create frequency-based milestones/decks such as:

&nbsp;

- Top 50

- Top 100

- Top 250

- Top 500

- Top 1,000

- Top 2,000

- Top 5,000

- Top 10,000

- Top 20,000

&nbsp;

The learner should be able to see:

&nbsp;

«You know 820 / 1,000 of the most common words»

&nbsp;

and therefore:

&nbsp;

«82% of the Top 1,000»

&nbsp;

The UI should make this feel like progression through the language.

&nbsp;

---

&nbsp;

5. Make Frequency Progress Gamified

&nbsp;

This should NOT feel like a statistics dashboard.

&nbsp;

It should feel like leveling up.

&nbsp;

For example:

&nbsp;

🇫🇷 French

&nbsp;

TOP 1,000 WORDS

&nbsp;

████████████████░░░░ 82%

&nbsp;

820 / 1,000 words known

&nbsp;

As the learner reaches milestones, trigger a celebration.

&nbsp;

Examples:

&nbsp;

🎉 TOP 50 UNLOCKED

&nbsp;

You know the 50 most common French words!

&nbsp;

🔥 20% COMPREHENSION

&nbsp;

You just crossed 20% of the Top 1,000!

&nbsp;

🦎 LEVEL UP!

&nbsp;

You reached 50% of the Top 1,000.

&nbsp;

Use the existing LinguaScript/chameleon-style level-up feeling rather than introducing an unrelated visual language.

&nbsp;

The learner should feel that increasing comprehension is an achievement.

&nbsp;

---

&nbsp;

6. Daily Progress Should Be Visible

&nbsp;

Show how much frequency coverage the learner gained during the current day.

&nbsp;

For example:

&nbsp;

TODAY

&nbsp;

+18 common words

&nbsp;

Top 1,000 comprehension

72% → 74%

&nbsp;

+2%

&nbsp;

If the learner makes unusually large progress, celebrate it.

&nbsp;

Example:

&nbsp;

🚀 HUGE DAY

&nbsp;

You learned 37 of the

most common words today.

&nbsp;

Top 1,000:

61% → 65%

&nbsp;

Do not claim that a percentage equals an exact percentage of real-world spoken-language comprehension unless the underlying frequency data actually supports that claim.

&nbsp;

If the product uses claims such as "Top 50 = X% of daily spoken language", store the source/methodology and display the claim only when it is properly supported.

&nbsp;

The percentage should primarily represent:

&nbsp;

«percentage of the selected frequency list that the learner has mastered»

&nbsp;

This makes the metric transparent and defensible.

&nbsp;

---

&nbsp;

7. Frequency Deck UI

&nbsp;

Create a dedicated frequency-progress area.

&nbsp;

Possible structure:

&nbsp;

YOUR LANGUAGE

&nbsp;

🇫🇷 French

&nbsp;

Language Progress

━━━━━━━━━━━━━━━━━━

&nbsp;

TOP 50

████████████████████ 100%

&nbsp;

TOP 100

████████████████░░░░ 82%

&nbsp;

TOP 500

████████████░░░░░░░░ 61%

&nbsp;

TOP 1,000

████████░░░░░░░░░░░░ 42%

&nbsp;

TOP 5,000

████░░░░░░░░░░░░░░░░ 19%

&nbsp;

TOP 20,000

█░░░░░░░░░░░░░░░░░░░ 5%

&nbsp;

Each deck should be clickable.

&nbsp;

Clicking "Top 1,000" should show the learner:

&nbsp;

- words mastered

- words learning

- words remaining

- percentage complete

- words currently due

- next milestone

&nbsp;

---

&nbsp;

8. Define "Known" Clearly

&nbsp;

The comprehension percentage must use a consistent definition of "known".

&nbsp;

Do not count a word merely because it has been saved.

&nbsp;

A word should count toward frequency comprehension only when it reaches the application's defined mastered/learned state.

&nbsp;

Use the existing Red → Orange → Green vocabulary progression where possible:

&nbsp;

🔴 New

&nbsp;

🟠 Learning

&nbsp;

🟢 Learned

&nbsp;

Only the appropriate mastered/learned state should contribute to the "known" count.

&nbsp;

This connects frequency progression directly to LinguaScript's existing core vocabulary loop.

&nbsp;

---

&nbsp;

9. Common Sentence Patterns

&nbsp;

Create a new "sentence_patterns" table.

&nbsp;

Each pattern should contain:

&nbsp;

id

language

cefr_level

usage_rank

template

slots

explanation

example

example_translation

&nbsp;

Example:

&nbsp;

language: fr

cefr_level: A1

usage_rank: 1

&nbsp;

template:

"Je voudrais ___, s'il vous plaît."

&nbsp;

slots:

[

  {

    "name": "object",

    "type": "noun_or_phrase"

  }

]

&nbsp;

explanation:

"Used to politely say that you would like something."

&nbsp;

example:

"Je voudrais un café, s'il vous plaît."

&nbsp;

example_translation:

"I would like a coffee, please."

&nbsp;

Make the table publicly readable and admin-writable according to the application's existing Supabase security model.

&nbsp;

---

&nbsp;

10. Seed Core Sentence Patterns

&nbsp;

Initially create approximately 60 core sentence patterns per language for:

&nbsp;

- French

- Spanish

- Italian

- German

- Portuguese

&nbsp;

Cover A1 through C2.

&nbsp;

Prioritize structures learners encounter frequently:

&nbsp;

A1

&nbsp;

- stating

- identifying

- basic questions

- basic negation

- wants/preferences

- possession

- location

- simple requests

&nbsp;

A2

&nbsp;

- past

- future

- comparisons

- frequency

- ability

- obligation

- reasons

- basic conditions

&nbsp;

B1

&nbsp;

- opinions

- explanations

- hypothetical situations

- subordinate clauses

- reported information

- more complex past/future structures

&nbsp;

B2

&nbsp;

- argumentation

- nuance

- contrast

- complex conditionals

- formal structures

&nbsp;

C1–C2

&nbsp;

- advanced connectors

- formal register

- nuanced argumentation

- sophisticated hypothetical structures

- complex discourse patterns

&nbsp;

Do not create hundreds of patterns unnecessarily in the first migration.

&nbsp;

The initial goal is a high-quality core library.

&nbsp;

---

&nbsp;

11. Connect Sentence Patterns to Exercises

&nbsp;

Currently exercises can be generated primarily around a saved vocabulary item.

&nbsp;

Change this so an exercise considers BOTH:

&nbsp;

1. the learner's vocabulary priority

2. the learner's sentence-pattern progression

&nbsp;

Exercise generation should select:

&nbsp;

Vocabulary

&nbsp;

The highest-priority frequent word that:

&nbsp;

- the learner does not know, OR

- is due for review

&nbsp;

AND

&nbsp;

Sentence Pattern

&nbsp;

A pattern that:

&nbsp;

- matches the learner's language

- is at or slightly below the learner's current level

- has not been drilled recently

- is appropriate for the vocabulary item

&nbsp;

Then ask the AI to generate a natural sentence using:

&nbsp;

TARGET WORD

+

TARGET SENTENCE PATTERN

&nbsp;

The generated sentence must actually follow the selected pattern.

&nbsp;

---

&nbsp;

12. Record the Pattern Used

&nbsp;

Add:

&nbsp;

pattern_id uuid

&nbsp;

to:

&nbsp;

linguascripts

&nbsp;

with a foreign-key relationship to:

&nbsp;

sentence_patterns

&nbsp;

Every generated exercise/LinguaScript should record the pattern used.

&nbsp;

This allows the system to track:

&nbsp;

- which structures the learner has practiced

- which structures are overdue

- which patterns have been mastered

- which patterns need more exposure

&nbsp;

---

&nbsp;

13. Pattern Rotation

&nbsp;

Do not repeatedly use the same sentence structure.

&nbsp;

The selection algorithm should consider:

&nbsp;

pattern level

+

frequency/usage rank

+

recent usage

+

learner performance

&nbsp;

Patterns should gradually become more difficult as the learner progresses.

&nbsp;

The system should therefore create a learning loop:

&nbsp;

COMMON WORD

      ↓

SENTENCE PATTERN

      ↓

REAL/NATURAL SENTENCE

      ↓

EXERCISE

      ↓

REVIEW

      ↓

MASTERED

      ↓

NEXT COMMON WORD + NEXT PATTERN

&nbsp;

---

&nbsp;

14. Update Queue Ordering

&nbsp;

Update:

&nbsp;

src/lib/linguascripts.ts

src/lib/vocab.ts

&nbsp;

so vocabulary selection incorporates frequency.

&nbsp;

The general priority should be:

&nbsp;

1. Due reviews

2. High-frequency unknown vocabulary

3. Appropriate sentence-pattern rotation

4. Lower-frequency vocabulary

5. Unranked vocabulary

&nbsp;

Do not break the existing spaced-repetition/learning-state logic.

&nbsp;

Frequency should enhance the current system, not replace it.

&nbsp;

---

&nbsp;

15. Edge Function

&nbsp;

Update:

&nbsp;

generate-personalized-linguascript

&nbsp;

so it accepts the selected sentence pattern.

&nbsp;

The AI prompt should explicitly constrain generation to the supplied pattern.

&nbsp;

The generated sentence must:

&nbsp;

- contain the target vocabulary

- follow the supplied pattern

- sound natural in the target language

- match the intended CEFR difficulty

- include the correct meaning/context

&nbsp;

Record the selected pattern on the resulting LinguaScript.

&nbsp;

---

&nbsp;

16. Important UX Principle

&nbsp;

Do not expose all of this as technical terminology.

&nbsp;

The learner should not feel like they are looking at a database.

&nbsp;

The experience should feel like:

&nbsp;

«You're unlocking the language from the most important words upward.»

&nbsp;

The strongest visual progression remains:

&nbsp;

🔴 New → 🟠 Learning → 🟢 Learned

&nbsp;

But frequency adds a second progression:

&nbsp;

Top 50

↓

Top 100

↓

Top 500

↓

Top 1,000

↓

Top 5,000

↓

Top 10,000

↓

Top 20,000

&nbsp;

The combination gives LinguaScript two simultaneous progression loops:

&nbsp;

Word mastery

&nbsp;

🔴 → 🟠 → 🟢

&nbsp;

Language coverage

&nbsp;

0% → 10% → 20% → 50% → 80% → 100%

&nbsp;

This should become a central motivational mechanic of the product.

&nbsp;

---

&nbsp;

17. What NOT to Change

&nbsp;

Do not:

&nbsp;

- replace the existing 20,000-word lists

- import new word lists

- create duplicate vocabulary

- delete user vocabulary

- reset learning progress

- replace the existing Red/Orange/Green system

- make frequency the only factor in review scheduling

- create unsupported claims about real-world comprehension

&nbsp;

All 17 languages already have the required 20,000-word frequency data.

&nbsp;

The task is to build the product functionality around the existing data.

&nbsp;

---

&nbsp;

18. Acceptance Criteria

&nbsp;

Before considering the implementation complete, verify:

&nbsp;

Vocabulary

&nbsp;

- [ ] Every language has exactly 20,000 core vocabulary words

- [ ] French/Portuguese/Russian legacy rows above 20,000 are removed

- [ ] No duplicate ranks

- [ ] No duplicate words

- [ ] Existing learner vocabulary remains intact

&nbsp;

Saved words

&nbsp;

- [ ] Frequency rank populated where a match exists

- [ ] Frequency level populated where a match exists

- [ ] Unmatched words remain valid

- [ ] Frequency index exists

&nbsp;

Frequency progression

&nbsp;

- [ ] Top 50 deck exists

- [ ] Top 100 deck exists

- [ ] Top 250 deck exists

- [ ] Top 500 deck exists

- [ ] Top 1,000 deck exists

- [ ] Top 2,000 deck exists

- [ ] Top 5,000 deck exists

- [ ] Top 10,000 deck exists

- [ ] Top 20,000 deck exists

- [ ] Progress percentage is calculated from mastered words

- [ ] Progress updates immediately after mastery

- [ ] Milestone celebrations work

- [ ] Daily frequency progress is visible

&nbsp;

Sentence patterns

&nbsp;

- [ ] "sentence_patterns" table exists

- [ ] Core patterns seeded for the first five languages

- [ ] CEFR levels assigned

- [ ] Usage ranks assigned

- [ ] Templates and slots stored

- [ ] Examples and translations stored

- [ ] Security policies configured

&nbsp;

Exercise generation

&nbsp;

- [ ] Frequency priority influences vocabulary selection

- [ ] Sentence patterns influence generation

- [ ] Recently used patterns are deprioritized

- [ ] Pattern difficulty follows learner level

- [ ] Generated LinguaScripts record "pattern_id"

- [ ] Existing SRS/learning-state behavior remains functional

&nbsp;

UX

&nbsp;

- [ ] Learner can understand frequency progress without technical explanation

- [ ] Frequency progress feels like progression/leveling

- [ ] Milestone celebrations are visually consistent with LinguaScript's existing chameleon/level-up experience

- [ ] The system never presents unsupported comprehension claims as scientific fact

&nbsp;

Final Product Goal

&nbsp;

The learner should open LinguaScript and immediately understand:

&nbsp;

«I am learning the words that matter most.»

&nbsp;

«I can see exactly how much of the core language I have mastered.»

&nbsp;

«Every word I master increases my language coverage.»

&nbsp;

«I'm not just memorizing vocabulary — I'm learning how those words actually work inside sentences.»