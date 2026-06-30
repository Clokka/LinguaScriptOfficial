---
name: Feature Sprint 2026 (Prompt Direction)
description: 4 ordered rounds to beat Lingopie — Ding sound, Phrase saving, Mid-video Quiz, Pronunciation Judge. 70-credit budget, ship as separate prompts.
type: feature
---

Source: Google Slides "linguascript prompt direction"
https://docs.google.com/presentation/d/1Z-r4ssd9wIj45tMosqD1Za3X-pdd8V9hk5T0uucCIc8

Goal: match Lingopie on interactivity while keeping our edges (red/orange/green word system, pet companion, comprehension score). /upgrade page already shipped.

# CRITICAL RULE
Send each round as a SEPARATE Lovable prompt. Never combine — credits burn on conflict resolution.

# Round 1 — Ding Sound on Word Save (2–3 cr)
**What:** Two-tone chime (520Hz → 660Hz, ~200ms, sine wave, gain fade) generated via Web Audio API on every word save. No external audio file. Works guest + logged-in.
**Why:** Huberman — auditory reward spikes dopamine independently of visual. Pavlovian loop. Lingopie uses this; we need our own branded sound.
**Spec:**
1. Create `src/lib/sounds.ts` exporting `playWordSaved()`
2. Web Audio API: `AudioContext → OscillatorNode → GainNode`
3. Two-tone: 520hz (80ms) → 660hz (120ms), sine, smooth gain fade
4. Call in `Watch.tsx` after supabase upsert resolves
5. Also call in guest save path after `saveGuestWord()`
6. Auto-cleanup: disconnect oscillator after playback

**Lovable prompt (Round 1):**
> "Add a ding sound when a word is saved in Watch.tsx. Create src/lib/sounds.ts exporting playWordSaved() using Web Audio API — two-tone chime 520hz→660hz, ~200ms total, sine wave, smooth gain fade out. Call it after the successful supabase upsert in saveWordToFlashcards, and also in the guest save path after saveGuestWord(). Do not change anything else."

# Round 2 — Phrase Saving (full subtitle line) (8–12 cr)
**Flow:** Hover subtitle → "Save phrase" button → full subtitle line saved → translation auto-fetched → purple "phrase" badge in flashcards.
**Why:** Memory: context > isolated vocab. Phrase = grammar + vocab + pronunciation. Lingopie parity (must-have).
**Spec:** Add `onSavePhrase` to `SubtitleOverlay.tsx`. Store in `saved_words` with `is_phrase: true`. Fetch via `translate-word` edge function. Flashcard: phrase front, translation back. No IPA for phrases.
**HARD RULE:** Keep red/orange/green word colouring EXACTLY as-is. Phrases do NOT receive knowledge-state colours.

# Round 3 — Mid-Video Vocab Quiz / Learning Break (12–18 cr)
**Trigger:** After 5 words saved this session (useRef + once-per-session guard). Video auto-pauses → `LearningBreakModal` opens (glass-panel-strong style) → 3 multiple-choice Qs from session's saved words (1 correct + 3 random distractors) → each correct = +5 XP via `award()` → quiz ends → summary → `triggerReaction('celebrate')` → "Keep Watching" button resumes video.
**Why:** Extra Credits — variable ratio reward; unpredictable interrupt = surprise = dopamine spike. Second reward peak per session.
**Spec:** New `src/components/LearningBreakModal.tsx`. Match existing dark glassmorphism modal style.

# Round 4 — Pronunciation Judging (12–18 cr)
**Flow:** Mic button (lucide Mic icon) next to each subtitle in transcript panel → click → subtitle shown prominently + pulsing red dot → Web Speech API records up to 5s → score = % of target words matched in recognised text → any attempt = +5 XP → pet reacts happy if >60% → if SpeechRecognition unavailable, button hidden silently.
**Scoring bands:** 🟢 90%+ Excellent · 🟠 60–89% Good Try · 🔴 <60% Keep Practising.
**Why:** Real skill acquisition. Active recall — answers Grandpa Claude critique about "entertainment with subtitles".
**Spec:** New `src/components/PronunciationJudge.tsx`. Language map: fr→fr-FR, es→es-ES, de→de-DE, etc. Dark glassmorphism style.

# Why LinguaScript wins after this sprint
After this sprint we match Lingopie on interactivity, but we still uniquely have:
- 🔴🟠🟢 Red/Orange/Green knowledge-state word colouring in real time (no competitor has this)
- 🐾 Pet companion = Tamagotchi effect = bonded users churn 40% less
- 📊 Per-video comprehension score arc (23% → 100% across rewatches)
- 🎙️ Pronunciation + context saving = full acquisition loop

LinguaScript = Lingopie interactivity + Language Reactor depth + Duolingo retention + a pet that loves you back.

# Budget
70 credits available; 4 features fit with ~20 spare for fixes.
| | R1 Ding | R2 Phrase | R3 Quiz | R4 Pronunciation | /upgrade |
|---|---|---|---|---|---|
| Cost | 2–3 | 8–12 | 12–18 | 12–18 | done |
