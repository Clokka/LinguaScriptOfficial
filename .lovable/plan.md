## LinguaScript – Comprehension Tracking & Discover Overhaul

A focused rebuild of three pieces: (1) Discover becomes a live storefront for admin-curated content, (2) per-watch comprehension history is tracked and visualised, (3) Home becomes a personalised dashboard driven by that history.

---

### 1. Database

**New: `watch_sessions`** — one row per completed viewing (scales to millions, indexed by user+film).
- `user_id, film_id, language, watch_number, comprehension_pct, prev_comprehension_pct, delta, green_count, orange_count, red_count, total_tokens, duration_watched_seconds, completion_pct, watched_at`
- Indexes: `(user_id, watched_at desc)`, `(user_id, film_id, watch_number)`

**Extend `films`**: add `cefr_level text`, `tags text[]`, `duration_seconds int`, `description text`.

**Extend `video_comprehension`**: add `watch_count int default 0`, `total_minutes int default 0`, `best_score numeric(5,2)`.

**RPCs**
- `record_watch_session(film_id, language, comprehension, counts...)` → inserts watch_sessions row, increments watch_count, updates latest/best on `video_comprehension`, returns `{watch_number, prev_pct, new_pct, delta}`.
- `user_progress_stats()` → avg comprehension, highest, avg gain/watch, videos mastered (≥90%), in progress, hours watched, vocab learned.
- `user_learning_rate(language)` → 7-day comprehension delta per language.

All tables: GRANTs to authenticated + service_role, RLS scoped to `auth.uid()`.

---

### 2. Discover page (`src/pages/Browse.tsx` — Discover tab)

Stop calling `youtube-search`. Fetch directly from `films` where `is_public = true`, ordered by `created_at desc`. Filter chips by language / CEFR / category / tag. Each card shows: thumbnail, title, language flag, difficulty stars, CEFR badge, category, duration, tags, estimated comprehension (computed from user's deck), and a "New" badge if `created_at` within 7 days.

Clicking a card opens `/watch/:id` directly (no import step — it's already a film).

---

### 3. Watch page (`src/pages/Watch.tsx`)

On video completion (already detected):
1. Compute comprehension via existing `videoComprehension.ts`.
2. Call `record_watch_session` RPC.
3. Show a polished **Results Modal**:
   - Big animated `prev% → new%` counter with delta chip ("+16%").
   - Watch number ("Watch #3").
   - Mini timeline of all previous watches (animated bar chart).
   - Vocabulary impact: words mastered this session, new words encountered.
   - XP earned, streak, mastery progress bar (toward 90%).
   - Buttons: "Watch again to improve", "Find next video".

---

### 4. Home (`src/pages/Browse.tsx` — Home tab)

Replace existing rails with personalised, history-driven rails — all sourced from `films` table (no external content):

- **Continue Watching** — `watch_history` where `completion_pct < 95`, joined to films.
- **Recently Improved** — `video_comprehension` ordered by `delta desc` (last 14 days).
- **Almost Mastered** — `latest_score` between 75 and 89.
- **Recommended Next** — same language + CEFR ±1 of user, excluding mastered.
- **New This Week** — films created in last 7 days, matching learning language.
- **Because you studied {language}** / **Because you like {category}** — admin films grouped by category from user history.

Each Continue Watching card shows: thumbnail, title, language, last watched, watch #, current %, prev %, improvement.

---

### 5. Your Progress dashboard

New `src/components/YourProgressDashboard.tsx` on Home tab:
- Average comprehension, highest video %, avg improvement/watch, videos mastered, videos in progress, hours of input, vocab learned from videos.
- **Learning Rate** card per active language ("+14% this week"), sourced from `user_learning_rate` RPC.

---

### 6. Files

**New**
- `supabase/migrations/{ts}_watch_sessions_and_progress.sql`
- `src/components/WatchResultsModal.tsx`
- `src/components/ComprehensionTimeline.tsx`
- `src/components/YourProgressDashboard.tsx`
- `src/components/DiscoverCatalog.tsx`
- `src/lib/learningHistory.ts` (RPC wrappers + types)

**Edited**
- `src/pages/Watch.tsx` — call `record_watch_session`, show results modal.
- `src/pages/Browse.tsx` — replace Discover content source, rebuild Home rails.
- `src/components/PersonalizedRails.tsx` — repointed at `films` table OR retired in favour of new components.
- `src/components/YourProgressSection.tsx` — extended with new metrics.
- `src/pages/Admin.tsx` — surface new film fields (cefr_level, tags, duration, description) in the film editor.

---

### Out of scope (call out)

- Gems / Explorer Mode — not built yet; XP + streak only.
- Listening vs reading confidence as separate scores — folded into the single comprehension % unless you want a second pass.

Confirm and I'll build it.