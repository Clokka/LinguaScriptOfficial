
# LinguaScript 2.0 — Adventure Mode

This is a large vision. To keep credits safe and avoid breaking what already works, I'll ship it in **4 phases**. Each phase is fully usable on its own — you decide after each one whether to continue.

---

## Phase 1 — Home Page Rewrite (the most visible change)

Strip `/browse` Home down to the new journey layout:

1. **Understanding Hero** (kept) — overall % + CEFR + "X words to next milestone"
2. **Continue Watching** (kept, restyled) — promoted to the primary "Continue your quest" card with current understanding + transcript progress + big Continue button
3. **Catalog Rows from Admin** — replace `Your Lessons` with rows pulled from existing `catalog_rows` / `catalog_row_films` tables (🔥 Trending, 🇫🇷 Beginner French, 🎬 Classics, 😂 Comedy, etc.). Netflix-style horizontal scrollers.
4. **Remove** the 7-card Your Progress dashboard from Home (it stays accessible from a dedicated `/progress` sub-page so the data isn't lost).

**Difficulty rating change:** every content card shows `Estimated Understanding XX%` with a label band — `Perfect Match` (70–85%), `Comfortable` (>85%), `Stretch` (40–70%), `Recommended Later` (<40%). Estimate is computed from the user's deck vs the film's subtitle tokens (we already have this code in `videoComprehension.ts`).

---

## Phase 2 — Transcript Mastery (the core new mechanic)

The transcript becomes the collectible.

- New column `films.transcript_mastery_pct` is **not** needed — we already track `green/orange/red/total_tokens` per video in `video_comprehension`. We'll surface a **Transcript Progress** bar (green% over total content tokens) everywhere the video appears.
- Watch page gets a persistent "Turn the transcript green" meter.
- When a transcript hits 100% green: full-screen **🏆 LinguaScript Complete** celebration (confetti + sound + XP + Gems + "New content unlocked"). New table `transcript_completions` to record the moment once.
- Continue Watching cards show transcript% alongside comprehension%.

---

## Phase 3 — Game Layer (XP / Gems / Daily Quests / Levels / Worlds)

- **Gems**: new `profiles.gems` column. Awarded on transcript completion, daily quest completion, streak milestones, level ups.
- **Daily Quests**: new `daily_quests` table (user_id, date, quest_key, target, progress, completed_at, reward_xp, reward_gems). 3 quests rolled per day from a fixed pool (watch 15min, learn 20 words, review 30 cards, +10% on one transcript, complete 1 LinguaScript). Surface as a card on Home.
- **Level titles** (Explorer → Master) — pure cosmetic mapping on top of existing XP system; no schema change.
- **Worlds**: new `worlds` table + `films.world_id`. Admin can assign each film to a world. Home gets a "Your Journey" strip showing which worlds are unlocked. Unlock rule: complete N transcripts in current world to unlock next. Harder worlds still browsable but flagged "Challenging".

---

## Phase 4 — Pets & Celebrations (polish)

- Pets react to milestones (Lottie/Framer animations on transcript completion, level up, daily quest sweep).
- Gem shop for cosmetic pet items (no real-money).
- Achievement badges on Profile.

---

## Technical changes summary (Phase 1 only — what I'll build next if you approve)

```text
src/pages/Browse.tsx                 → remove YourProgressDashboard from Home tab
src/components/HomeCatalogRows.tsx   → NEW: fetch catalog_rows + films, horizontal rails
src/components/ContentCard.tsx       → NEW: shared card with estimated-understanding badge
src/lib/videoComprehension.ts        → add estimateForFilm(userId, filmId) memoised helper
src/pages/Progress.tsx               → NEW: move the 7-stat dashboard here
src/components/NavBar.tsx            → add "Progress" link
```

No DB migration in Phase 1.

---

## Questions before I start Phase 1

1. **Confirm the kill list** — you're okay removing Avg Comprehension, Best Video, Videos Mastered, Gain/Watch, Hours of Input, Vocabulary Learned, Learning Rate from Home (moved to `/progress`)?
2. **Catalog rows** — should I render every row in `catalog_rows` ordered by `position`, or only ones explicitly flagged `show_on_home`? (I can add a flag if needed.)
3. **Scope confirmation** — start with **Phase 1 only**, then check in?

Once you answer (or just say "go phase 1"), I'll ship it.
