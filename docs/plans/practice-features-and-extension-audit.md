# Practice features (Sentence Blast, notes, shadowing) + extension↔flashcards DB audit

**Status: PLAN + AUDIT ONLY — no implementation. For discussion.**

---

## Part 1 — The practice layer

Three requested capabilities, unified by one idea: LinguaScript's identity is
*the transcript that turns green*, so every practice mode should end in the
same payoff — a Line Blast.

### A. Sentence Blast (gap-fill from the user's own flashcards) — the headline

The Block Blast mechanic, applied to *production* instead of recognition:

1. Pull real subtitle lines the learner has already watched (we know them
   from watch history) that contain 1–3 words currently in their **red or
   orange** decks.
2. Show the line with those words blanked: `Elle regarde la ____ tomber sur
   la ville`. The rest of the line renders green — the learner sees their own
   progress framing each gap.
3. Learner fills the gap from a 4-tile word bank (their own deck words as
   distractors), or types it in "hard mode".
4. Each correct fill turns the word green in place; filling the **last** gap
   completes the line → **full Line Blast** (gold sweep, scatter, praise).
5. Consecutive completed sentences build the combo ×1→×5 and multiply XP —
   identical state machine to the watch-page plan, so we build the combo
   logic once (`src/lib/lineBlast.ts`) and share it.
6. Correct fills feed the existing forward-only SRS (`nextState`): a red word
   filled correctly → orange; orange → green. This makes Sentence Blast a
   *review session that feels like a game*, not a separate feature.

Sub-modes (later phases):
- **Word-order build**: shuffled tiles of a full known line; arrange to
  rebuild it. Completion = blast.
- **Free compose**: write your own sentence using N deck words; an edge
  function (existing supabase functions pattern) checks grammar and awards a
  blast on success.

### B. Repeat what the actors say (shadowing)

- **Loop-a-line**: button on the subtitle panel replays the current
  subtitle's time range (we already track cue timestamps in Watch).
  Optional 0.75× rate via YouTube player API.
- **Record & compare**: mic capture (MediaRecorder), play actor line then
  the learner's take back-to-back.
- **Scoring**: the repo already has `PronunciationJudge.tsx` — reuse it to
  grade the take. A "good" grade can count as a correct review for every
  deck word in that line (batch SRS credit), and a full-line pass on a line
  at 100% green triggers — again — a Line Blast.
- Storage: nothing persisted by default (privacy); optional later.

### C. Notes

- Notepad attached to (video, subtitle line): new `user_notes` table
  `(id, user_id, video_id, cue_index, note text, created_at)` with RLS
  matching `saved_words` policies.
- UI: small 📝 toggle on the subtitle panel in Watch; notes list surfaced on
  the Vocabulary page and on the video's completion screen.
- Notes are also the natural home for "my practice sentences" from mode A/C.

### Suggested build order

1. `lineBlast.ts` shared combo/XP logic + tests (unblocks watch page AND Sentence Blast)
2. Sentence Blast MVP: gap-fill from deck words, tile bank, blast on completion (new route `/practice`)
3. Notes table + Watch UI (small, independent)
4. Shadowing loop-a-line (player-only, no mic) → then record & compare → then PronunciationJudge scoring
5. Word-order + free compose modes

Open questions: how many gaps per line feels right (1 vs up to 3)? Does
Sentence Blast live inside Flashcards as a session type, or as its own
`/practice` tab? Should typing mode be required for orange→green promotions?

---

## Part 2 — Extension ↔ flashcards database audit

The extension (`extension/background.js`) and the app (`src/lib/vocab.ts`,
Watch/Flashcards) both read and write `saved_words`, but they disagree in
five places. Ranked by user-visible damage:

### 1. Two different definitions of "green" (worst)
- App: the `state` column (`red/orange/green`, forward-only) is the single
  source of truth everywhere (subtitles, flashcards, Line Blast plans).
- Extension (YouTube overlay, `background.js:353`): computes green from the
  **legacy SRS columns**: `interval_days >= 21 || (review_count >= 5 &&
  ease_factor >= 2.5)`.
- Result: a word the learner turned green in the app shows as not-green on
  YouTube, and vice versa. **Fix: extension should select and trust `state`.**

### 2. Tokenization mismatch — extension words can never match subtitles
- App key: `normalizeToken` strips apostrophes → `s'il` → `sil`.
- Extension: keeps internal apostrophes/hyphens → saves `s'il`.
- A word saved by the extension with an apostrophe/hyphen will never color a
  subtitle token in the app, and can be double-saved under two spellings.
  **Fix: share one normalize function (copy `normalizeToken` verbatim into
  the extension).**

### 3. Inconsistent language defaults → invisible words
- Bulk sync defaults `language: 'es'` (`background.js:170`); single-word
  save defaults `'fr'` (`background.js:382`).
- The app loads decks filtered by language, so words tagged with the wrong
  language simply never appear. **Fix: require an explicit language (from
  the video/page), never default.**

### 4. Duplicate checks ignore language
- `fetchExistingWords` selects `word` only, and the single-word save checks
  `word=eq.X` with no language filter — so French `chat` is skipped if
  Spanish `chat` exists. **Fix: dedupe on (word, language).** Consider a DB
  unique index on `(user_id, word, language)` to enforce it everywhere.

### 5. Bulk sync floods the deck
- "Sync" inserts **every** non-stopword ≥3 chars from captured subtitles as
  a red card (with an English stopword list even for Spanish/French content,
  and dropping meaningful short words like `eau`, `vin`, `ir`).
- Hundreds of never-chosen red words skew the deck, the daily review queue,
  and `estimateLanguageUnderstanding`. **Fix: language-aware stopwords (the
  app's `FUNCTION_WORDS` in `understanding.ts` already has them), drop the
  3-char floor, and consider making bulk-sync opt-in per video.**

### Minor
- Extension still writes legacy SRS fields (`next_review`, `ease_factor`,
  `interval_days`) that the app no longer maintains (`recordReview` is a
  no-op) — harmless but misleading; stop writing them once #1 is fixed.
- Extension inserts omit `state` — lands on the DB default `'red'`
  (migration `20260613220200`), which is correct today but implicit; set it
  explicitly.
- Anon key + URL are hardcoded in the extension (normal for Supabase anon,
  but worth confirming RLS on `saved_words` is user-scoped — the policies in
  migrations look correct).

### Proposed fix order
1. Extension reads `state` for coloring (#1) — one query change
2. Shared `normalizeToken` (#2)
3. Explicit language + (word, language) dedupe (#3, #4) + unique index migration
4. Bulk-sync quality pass (#5)
