# LinguaScript Adaptive Progression System

**Status: RESEARCH AND ARCHITECTURE PROPOSAL ONLY — no progression behavior has been implemented.**

## 1. Product objective

Build a progression system that continuously answers three questions:

1. What can this learner reliably understand now?
2. Which film or exercise is challenging enough to create learning, without breaking comprehension?
3. What evidence is sufficient to advance the learner's ability estimate?

The system should preserve LinguaScript's core promise: learners progress by watching authentic content whose transcripts visibly turn green. XP, streaks, gems, and pets should celebrate that learning, not determine language ability or lock essential learning content.

## 2. Recommended progression model

Use a multidimensional learner model rather than one global XP level.

### Learner ability profile

Maintain one profile per user and learning language with these signals:

- **Vocabulary coverage:** weighted proportion of transcript vocabulary currently green, orange, and red.
- **Observed comprehension:** rolling, recency-weighted comprehension from completed watch sessions.
- **Listening performance:** accuracy and response time on gap-fill, multiple-choice, and pronunciation checks.
- **Retention confidence:** expected recall from the canonical spaced-repetition scheduler.
- **Content breadth:** number of distinct topics, speakers, and videos successfully understood.
- **Estimated CEFR band:** a display summary derived from the underlying signals, not the primary calculation.

The ability profile should include a confidence value. New learners have a broad uncertainty range; repeated evidence narrows it. This prevents one excellent or poor session from producing a disruptive jump.

### Content difficulty profile

Give each film a canonical difficulty profile rather than relying only on a manually entered CEFR label:

- lexical frequency and vocabulary-level distribution;
- weighted unknown-word density;
- speech rate and subtitle density;
- sentence length and syntactic complexity;
- idiom, slang, and proper-noun density;
- audio quality and speaker overlap where measurable;
- observed difficulty from real learners, once enough data exists.

Store a continuous internal difficulty score plus an explainable CEFR projection. Existing labels such as beginner/intermediate/advanced and 1–5 stars should become presentation mappings of this canonical score, not independent systems.

### Content-fit score

Rank content per learner using a 0–100 fit score composed from:

| Input | Initial weight | Purpose |
|---|---:|---|
| Predicted weighted comprehension | 45% | Keep content comprehensible |
| Vocabulary learning opportunity | 20% | Introduce a manageable amount of orange/red language |
| Learner interests | 15% | Preserve motivation |
| Recent learning pace | 10% | Adapt challenge to improvement rate |
| Novelty and breadth | 5% | Avoid repetitive topics/speakers |
| Completion likelihood | 5% | Avoid repeatedly recommending abandoned formats |

The initial target zone should be **85–95% predicted weighted comprehension**, matching the existing `zoneMessage` model. Content at 70–84% is a deliberate stretch option. Below 70% should not be the default next step, while above 95% is useful for fluency, confidence, and relaxed viewing.

These weights are starting hypotheses. They should be tuned from completion, comprehension improvement, and retention data rather than treated as permanent constants.

## 3. Progression loop

```text
Choose content in the target zone
             |
             v
Watch with weighted transcript tracking
             |
             v
Collect evidence: completion, comprehension, checks, saved words
             |
             v
Update ability and recall confidence with bounded movement
             |
             v
Schedule review + rank the next content set
```

### Advancement rules

- Update the learner estimate after a meaningful session, not after every click.
- Require both sufficient completion and enough scored transcript coverage before accepting a comprehension result.
- Apply a recency-weighted moving estimate with maximum per-session movement to prevent volatility.
- Advance the displayed CEFR band only after sustained evidence across several distinct videos.
- Allow temporary regression in the internal estimate while keeping the user-facing message constructive.
- Do not use XP, gems, streak length, or subscription tier as evidence of language ability.

### Recommended evidence thresholds for an MVP

- A qualifying watch: at least 10 minutes or 60% completion for shorter content.
- A mastery signal: at least three qualifying sessions across two or more distinct videos in the target zone.
- An advance signal: rolling comprehension at or above 90%, positive or stable review retention, and no single video contributing more than half of the evidence.
- A support signal: two consecutive sessions below 70% should lower recommendation difficulty, but should not demote the public CEFR badge immediately.

These thresholds should be configurable and evaluated against real use before being fixed as product policy.

## 4. Daily experience

The current mission loop can become an adaptive three-part plan:

1. **Review:** due red/orange vocabulary selected by the single canonical scheduler.
2. **Watch:** one recommended video in the learner's target comprehension zone.
3. **Consolidate:** a short LinguaScript generated from words encountered in that video.

The learner should always be able to browse outside the recommendation. Difficulty is guidance, not a hard gate. If unlocks are later introduced, they should unlock curated challenges, badges, or optional adventures—not prevent access to ordinary learning content.

## 5. Architecture: reuse before adding systems

### Existing sources of truth to retain

- `saved_words.state` for the active red/orange/green deck model.
- `core_vocabulary` for frequency and onboarding seeding data.
- `watch_sessions` and `video_comprehension` for observed comprehension.
- `films.cefr_level`, subtitles, duration, and language for content metadata.
- `user_progress_stats()` and `user_learning_rate(language)` for aggregate progress signals.
- `xp_events`, levels, gems, and rewards as a separate motivational layer.

### Stage 0 — consolidation prerequisite

Do this before adding adaptive recommendations:

1. Choose one spaced-repetition scheduler. The codebase currently contains forward-only deck promotion, legacy SM-2-like fields, database interval calculations, and a separate fixed 1/3/7-day rule. A modern FSRS implementation is the recommended long-term source of scheduling truth; migration must preserve the visible red/orange/green model.
2. Unify `videoComprehension.ts` and `contentEstimate.ts` around one tokenization, weighting, and scoring implementation.
3. Define `user_vocabulary_state` as either a retired duplicate or a clearly bounded aggregate; it must not compete with `saved_words.state`.
4. Resolve competing LinguaScript RPC generations and schemas before building on their review data.
5. Normalize CEFR, 1–5 stars, and beginner/intermediate/advanced into one canonical content-difficulty model.

### Stage 1 — canonical scoring

Add one backend-owned content-difficulty calculation and one per-user content-fit calculation. The progression layer may read deck, comprehension, and activity data, but it must not independently write deck state, review dates, XP, or rewards.

Suggested logical records:

- `content_difficulty`: film, language, model version, continuous score, CEFR projection, feature breakdown, confidence, calculated time.
- `learner_ability`: user, language, ability score, CEFR projection, confidence, component signals, updated time.
- `content_fit`: user, film, predicted comprehension, fit score, reason codes, model version, calculated time.

Scores must be versioned so recommendations remain explainable after the model changes.

### Stage 2 — recommendation service

Provide one backend ranking operation for authenticated users. It should:

1. filter to the exact learning language;
2. exclude completed, hidden, unavailable, or recently dismissed content where appropriate;
3. score candidates using the learner profile and canonical content difficulty;
4. diversify results by topic and creator;
5. return reason codes such as `ideal_comprehension`, `matches_interest`, `builds_recent_words`, or `confidence_builder`;
6. fall back safely to curated language-matched content when confidence or subtitle data is insufficient.

Curated films should rank first because they have reliable transcripts. YouTube search can remain a discovery fallback, but should not outrank content whose difficulty can be measured accurately.

### Stage 3 — adaptive updates

After a qualifying session:

- record the watch result atomically;
- update the ability estimate with bounded movement;
- invalidate or refresh affected content-fit records;
- schedule vocabulary through the canonical scheduler;
- preserve an audit trail of the inputs and model version.

Batch or asynchronous recalculation should handle expensive catalog work. The watch-completion path should remain fast and idempotent.

### Stage 4 — progression presentation

Expose progress through:

- a stable CEFR summary with a confidence-aware progress indicator;
- “Why this video” explanations based on reason codes;
- comprehension history and rewatch improvement;
- vocabulary coverage toward the next milestone;
- optional challenge paths for learners who deliberately choose stretch content.

Avoid presenting false precision. “Strong A2, moving toward B1” is more honest than implying that one percentage is a standardized language qualification.

## 6. Cold start and special cases

### New learners

Use onboarding CEFR and seeded vocabulary only as priors. Start with a short calibration set spanning adjacent difficulty bands, then replace the prior as real watch evidence arrives.

### Sparse or missing subtitles

Do not estimate lexical difficulty from title/description alone. Mark confidence low and rely on curated CEFR, creator/category priors, or exclude the item from adaptive rails until subtitles are available.

### Multilingual learners

Every score and recommendation must be scoped by learning language. Never transfer mastery or ability across languages, though global preferences such as interests may be reused.

### Short videos

Require a minimum amount of transcript evidence and aggregate multiple shorts before allowing them to move the ability estimate materially.

### Gaming the system

Cap repeated evidence from the same content, discount implausibly fast completions, and keep XP separate from ability. Rewatch improvement remains valuable but should have diminishing influence.

## 7. Measurement and validation

Before rollout, instrument these outcomes:

- recommendation start and completion rate;
- predicted versus observed comprehension error;
- seven- and thirty-day vocabulary retention;
- rate of “too easy” and “too hard” feedback;
- rewatch comprehension delta;
- percentage of sessions in the intended target zone;
- learner retention segmented by starting level and language.

Roll out in shadow mode first: calculate and log rankings without changing the UI. Compare predicted fit with actual session outcomes. Then A/B test recommendation ordering, with a curated control group and guardrails for completion and retention.

## 8. Delivery sequence

1. **Data audit and consolidation:** resolve duplicate SRS, vocabulary, LinguaScript, and comprehension implementations.
2. **Offline scoring prototype:** calculate difficulty and fit for a representative French corpus; compare against expert CEFR labels and real comprehension outcomes.
3. **Shadow recommendations:** generate rankings without displaying them; evaluate calibration and language purity.
4. **Recommended rail:** ship reason-coded ordering with curated fallback and no hard gating.
5. **Adaptive daily mission:** connect review, target-zone viewing, and consolidation.
6. **Optional progression paths:** add challenge unlocks only after recommendation quality is proven.

## 9. Research basis

- [CEFR English Level Predictor](https://github.com/AMontgomerie/CEFR-English-Level-Predictor): useful feature-engineering reference for lexical and syntactic difficulty; its English-specific model should not be reused across languages.
- [CEFR-J / PyCEFRizer](https://github.com/straygizmo/PyCEFRizer): an explainable passage-level CEFR approach; validate against the underlying academic work before production use.
- [Knewton EDM 2016](https://github.com/Knewton/edm2016): reference implementations for Item Response Theory and knowledge tracing; useful mathematically, not as a maintained dependency.
- [DeepIRT](https://github.com/ckyeungac/DeepIRT): conceptual reference for jointly estimating learner ability and item difficulty by skill; its old runtime should not be adopted.
- [FSRS and ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs): the strongest maintained candidate for the canonical recall scheduler, using difficulty, stability, and retrievability.
- [ML for SLA](https://github.com/JonathanLaneMcDonald/ML_for_SLA): direct reference for known-vocabulary coverage and comprehensible-input selection; validate beyond its Japanese corpus.
- [Read Bridge](https://github.com/WindChimeEcho/read-bridge): current product reference for n+1 reading and in-flow glossing; relevant to experience design, not a complete progression engine.

No single reviewed project provides the entire LinguaScript pipeline. The recommended approach deliberately combines explainable content difficulty, bounded learner ability estimation, vocabulary retrievability, and comprehensible-input matching while retaining LinguaScript's existing watch and deck data.

## Decision recommendation

Approve **Stage 0 consolidation** as the next technical project, then validate an 85–95% target-zone scoring prototype in shadow mode. Do not begin with hard content gates, deep-learning knowledge tracing, or a new parallel vocabulary system.