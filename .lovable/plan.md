# LinguaScript Core Learning System: Red → Orange → Green

This is a large, defining feature. I'll break it into 4 phases so we can ship and validate each piece before moving on. Phase 1 is the foundation — let's confirm direction before I build the rest.

## Concept

Every one of the 3,000 highest-frequency French words is in one of three states for each learner:

- 🔴 Red — unknown
- 🟠 Orange — learning
- 🟢 Green — known

The headline metric becomes **frequency-weighted comprehension %**, not raw card counts.

---

## Phase 1 — Foundation (data + state engine)

**New database tables**

- `core_vocabulary` — the 3,000-word master list. Columns: rank, word, lemma, translation, pos, example_fr, example_en, frequency_weight, audio_url, image_url, topic. Public read.
- `user_vocabulary_state` — per-user state per word. Columns: user_id, word_id, state (`red`|`orange`|`green`), times_seen, times_correct, first_seen_at, promoted_at. RLS scoped to `auth.uid()`.
- Seed `core_vocabulary` with the top ~500 words first (real frequency list), with a follow-up seed migration to reach 3,000. Lemma + translation initially from a curated CSV; images filled in over time.

**State transition rules**

- New word clicked / appears in subtitles → Red (implicit, no row needed; default).
- Saved or reviewed once → Orange.
- Correctly reviewed 3+ times in flashcards with spacing → Green.
- "Again" on a Green card drops it back to Orange.

**Comprehension score**

```
comprehension = Σ(frequency_weight of green words) / Σ(frequency_weight of all 3000) * 100
```

Orange words count at 0.5×. Calculated client-side from a single query; cached per session.

## Phase 2 — Comprehension Dashboard

New `/progress` (or replace current dashboard tab) with:

- Big number: **74% French Comprehension** + animated progress bar.
- Three stat cards: Green / Orange / Red counts with color-coded MemoryStageCard style.
- Weekly delta: "+18 green, +42 orange, +2.1% comprehension this week" (uses `promoted_at` timestamps).
- "Next 10 most valuable words to learn" list — highest-frequency Red words.

## Phase 3 — Vocabulary Explorer

New `/vocabulary` page:

- Grid/list of all 3,000 words with colored dot indicator.
- Filters: state (red/orange/green), frequency band (1–500, 501–1500, 1501–3000), part of speech, topic.
- Search box.
- Click word → drawer with translation, audio, example sentence, "Mark as known" / "Reset" actions.

## Phase 4 — Subtitle Integration + Image Flashcards

- **Subtitles**: `SubtitleOverlay` looks up each word's lemma in `user_vocabulary_state`; renders a small colored dot before/under the word (red/orange/green). Clicking still opens the existing `WordPopup` — accessibility unchanged.
- **Flashcards**: when a word's `core_vocabulary.image_url` exists, show the image on the front of the card instead of (or above) the text. Correct answers promote state Red→Orange→Green.

## Technical notes

- Reuse existing `saved_words` for SRS scheduling; add a join/sync so reviews update `user_vocabulary_state`.
- Frequency weight uses Zipf-style scoring: `weight = 1 / rank` then normalized so top-3000 sums to 1.
- Lemma matching in subtitles: simple lowercase + strip punctuation in v1; proper lemmatizer later.
- Images: stored as URLs in `core_vocabulary.image_url`, served from Lovable Cloud storage. Initial seed has no images; we add them progressively.
- All new tables get explicit GRANTs + RLS per project rules.

## What I need from you

1. **Confirm phase 1 scope** — build foundation + seed top 500 words now, ship dashboard/explorer/subtitles in follow-ups?
2. **Frequency list source** — OK to use a public CC-licensed French frequency list (e.g. OpenSubtitles-derived), or do you have a specific list you want me to use?
3. **Replace or add?** — should the new Comprehension Dashboard replace the current progress view, or live alongside it at `/vocabulary`?

Once you confirm, I'll start with the Phase 1 migration.
