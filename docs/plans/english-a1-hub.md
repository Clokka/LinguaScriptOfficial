# LinguaScript English A1: free guide → LinguaScript universe

> **Status:** plan (November 2026). **One sentence:** a free, trustworthy "Pass English A1" guide on linguascript.co.uk (grammar, words, practice test) that learners find on Google, trust, and then keep using inside LinguaScript, watching their A1 % climb, until they want films, the app and the extension.

---

## 1. Ground rules (read first)

1. **Everything is written by us.** We do **not** re-upload, copy or lightly reword other sites' lessons, PDFs or word lists. Why: it is copyright infringement, Google ranks copied pages down, and it destroys the one thing this hub is for, which is **being the authority people trust**.
2. **Facts are free, wording isn't.** *Which* grammar points belong to A1 comes from the CEFR (Council of Europe) and is the same everywhere. We use that list, then write our own explanations, examples and exercises.
3. **Our own word list.** Build the A1 list from **word frequency** (same method as `/frequent-words`, `src/pages/FrequentWords.tsx`) + everyday topics, then sanity-check it against published CEFR lists (look, don't copy). Before using any outside list as data, check its licence.
4. **Cite sources.** Every page links to the CEFR and the references in §8. Honest citations are part of looking like an authority.
5. **Never promise what we can't prove.** "Prepare for A1" is fine. "Officially certified A1" is not, until §6 is real.

---

## 2. The funnel (buyer's journey)

| Stage | Learner thinks | We give | Measure |
|---|---|---|---|
| **Awareness** | "What do I need for English A1?" (Google) | `/english/a1` free guide: grammar, words, practice test | Organic visits |
| **Consideration** | "Can I trust this? Is it better than other sites?" | Clear explanations, examples from real films, sources cited, no sign-up needed to read | Time on page, pages per visit |
| **Activation** | "How much of A1 do I know?" | Free account → **"You know 62% of A1 words"** (tick words, quick quiz), progress saved | Sign-ups, first words saved |
| **Habit** | "I'm getting better!" | Grammar units with a check at the end; % goes up; gold reviews | Day-7 return |
| **Upgrade** | "I want to understand real films" | Films with A1-friendly coverage (`src/lib/coverage.ts`), Pro, phone app, Chrome extension | Paid % |
| **Proof** | "Can I show someone?" | A1 completion certificate (see §6 for honest levels) | Certificates issued, shares |

The pride loop: **every grammar unit and word set moves one visible number**, "A1 ready: 74%".

---

## 3. Full A1 syllabus (our structure)

Based on the CEFR A1 level ("can understand and use familiar everyday expressions and very basic phrases; can introduce themselves; can interact in a simple way if the other person talks slowly"). Explanations and examples to be written by us.

### 3a. Grammar (20 units, most useful first)

| # | Unit | Learner can… | Example |
|---|---|---|---|
| 1 | **be**: am / is / are | say who and what they are | *I'm Ana. She's a teacher.* |
| 2 | Subject pronouns + possessive adjectives | talk about people | *He is my brother. Their dog is big.* |
| 3 | **a / an / the** | name things | *a cat, an apple, the door* |
| 4 | Plural nouns | talk about more than one | *two books, three children* |
| 5 | **this / that / these / those** | point at things | *This is my phone.* |
| 6 | Questions with **be** + question words | ask simple questions | *Where are you from? How old is he?* |
| 7 | **there is / there are** | describe a place | *There's a park near my house.* |
| 8 | Prepositions of place | say where things are | *in, on, under, next to* |
| 9 | **have got / have** | talk about family and things | *I've got two sisters.* |
| 10 | Present simple (+ / –) | talk about routines | *I work. She doesn't drive.* |
| 11 | Present simple questions | ask about habits | *Do you like coffee?* |
| 12 | Adverbs of frequency | say how often | *always, usually, never* |
| 13 | Prepositions of time | say when | *at 6 pm, on Monday, in July* |
| 14 | **can / can't** | talk about ability and ask permission | *I can swim. Can I open the window?* |
| 15 | **like / love / hate + -ing** | talk about likes | *I love reading.* |
| 16 | Countable / uncountable + **some / any** | shop and order | *some bread, any milk?* |
| 17 | Imperatives | give simple instructions | *Open your book. Don't run.* |
| 18 | Present continuous | say what's happening now | *I'm watching a film.* |
| 19 | Past of **be**: was / were | talk about yesterday | *I was at home.* |
| 20 | Object pronouns + **'s** possessive | talk about people and things | *Call me. It's Tom's car.* |

Each unit page: 1-minute explanation · 6–10 examples (ideally lines from LinguaScript films) · common mistakes (especially for French/Spanish/Thai speakers) · 8-question check → result feeds the A1 %.

### 3b. Vocabulary (~700 words, 15 topics)

Numbers, time and dates · Family and people · Body and health · Food and drink · Home and furniture · Clothes and colours · Jobs · School and work · Town, places and directions · Transport and travel · Shopping and money · Weather and seasons · Free time, sport and hobbies · Feelings and adjectives · The 100 most frequent "small words" (the, and, it, to, of…) first.

Built from frequency, so the top 100 already cover about half of everyday speech (see `/frequent-words`). Each word: meaning, example sentence, audio, plus "Save to my deck" (red → green → gold → blue, `packages/core/src/review.ts`).

### 3c. Can-do skills (what an A1 exam tests)

- **Listening:** numbers, prices, times, simple directions, short slow conversations.
- **Reading:** signs, short messages, simple forms, short emails.
- **Writing:** fill in a form, write a 25–35-word message or postcard.
- **Speaking:** introduce yourself, answer simple personal questions, ask for things.

### 3d. Practice test

Free 20-minute **A1 practice test** (our own questions, all four skills where possible) → score and "what to study next" → sign up to save the result. The **same test at the end** shows progress (as in the teacher plan).

---

## 4. Pages and routes

| Route | Page |
|---|---|
| `/english/a1` | Hub: "Pass English A1: free guide", what A1 is, the 3 parts, start the test |
| `/english/a1/grammar` | The 20 units with progress ticks |
| `/english/a1/grammar/:slug` | One unit (explain → examples → mistakes → check) |
| `/english/a1/words` | Topic word sets with "you know X%" |
| `/english/a1/test` | Practice test |
| `/english/a1/sources` | Bibliography and method ("how we built this") |

Readable without an account (SEO). Saving progress needs a free account. Content lives as data in `src/lib/english/a1/*.ts` (one file per unit/topic), the same pattern as `src/lib/cognates/fastTrack.ts`. Pages lazy-loaded; first-load bundle unchanged. Use `src/components/premium` + `PageLoading`/`Skeleton`. Analytics through `src/lib/analytics.ts` (`a1_unit_completed`, `a1_test_finished`, `a1_words_known_updated`).

---

## 5. Build order

1. **Hub + 5 grammar units (1–5) + the 100 small words + the practice test.** Enough to launch and to use with your own students (Rapper, Camille).
2. Remaining 15 units + all 15 word topics; "A1 ready %" on the learner's Progress page.
3. Film examples inside units (lines from LinguaScript films that use the grammar point).
4. A2 using the same template.
5. Certificate, level 1 (see §6).

---

## 6. The certificate: honest levels

A certificate only "means something" when others trust **how** it was tested. Climb these steps in order and never claim a higher step than the one we're on.

| Level | What it is | What it takes |
|---|---|---|
| **1. Completion certificate** | "Completed LinguaScript English A1" (units + final test) | Our course + final test. Fine for motivation and LinkedIn. Never call it official. |
| **2. CEFR-aligned test** | "Score mapped to CEFR A1" | Test written to CEFR descriptors, piloted on real learners, cut scores set with a recognised method (the Council of Europe's manual *Relating Language Examinations to the CEFR*). Free CEFR-aligned tests such as EF SET show this works as a funnel. |
| **3. Trusted by partners** | Schools, language centres or employers accept it | Identity checks or proctoring, cheating protection, published method, then partnerships one by one (start with the schools in Classroom). |
| **4. Officially recognised** | Accepted like Cambridge / Trinity / LanguageCert | Years of data, independent validation and regulator or awarding-body partnerships. Long term. A realistic shortcut is to **partner with an existing recognised exam** (prep course + discount voucher) instead of competing with it. |

---

## 7. Success numbers

- Launch: hub + 5 units live; your own students use it weekly.
- 3 months: 1,000 organic visits/month to `/english/a1`, 10% start the test, 30% of testers sign up.
- 6 months: 20 units + words done; A1 % → films → first Pro upgrades traced to the hub.

---

## 8. Bibliography (read for structure; never copy)

- Council of Europe. *Common European Framework of Reference for Languages: Learning, Teaching, Assessment, Companion Volume* (2020). The official A1 descriptors.
- Council of Europe. *Relating Language Examinations to the CEFR: A Manual* (2009). How to align a test to CEFR levels.
- Nation, I.S.P. (2006). How large a vocabulary is needed for reading and listening? *Canadian Modern Language Review* 63(1).
- Webb, S. & Rodgers, M. (2009). The lexical coverage of movies. *Applied Linguistics* 30(3). (Both already used on `/frequent-words`.)
- Reference sites reviewed for topic coverage (structure only): test-english.com (A1 grammar), englishradar.com (A1 level), lenguia.com (A1 grammar), perfect-english-grammar.com (A1 curriculum PDF), esl-lounge.com (A1 word list).

---

## 9. Build prompt: step 1 (paste to Claude Code)

```
Read AGENTS.md and docs/plans/english-a1-hub.md first.

Build step 1 of the English A1 hub:
1. src/lib/english/a1/: data files for grammar units 1–5 (title, slug, can-do,
   our own 1-minute explanation, 8 examples, common mistakes, 8 check questions)
   and the 100 most frequent English words (word, simple meaning, example).
   Write all text ourselves; never copy outside sites.
2. Lazy routes /english/a1, /english/a1/grammar, /english/a1/grammar/:slug,
   /english/a1/words, /english/a1/test (20 questions), /english/a1/sources.
   Readable signed out; progress saved for signed-in users.
3. "A1 ready %" = units passed + A1 words known; show it on the hub.
4. Premium kit + PageLoading/Skeleton; analytics events via src/lib/analytics.ts;
   Seo component with titles like "Pass English A1: free grammar guide".
5. npx tsc --noEmit -p tsconfig.app.json and npx vite build must pass.
```
