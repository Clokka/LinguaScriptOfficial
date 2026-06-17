# LinguaScript — Architecture & Scaling Audit

_Target: ~1,000 concurrent learners on Lovable Cloud (Supabase + React/Vite)._

## TL;DR — can we hit 1k users today?
**Yes, with small targeted fixes.** The bottlenecks at 1k DAU will be (in order):

1. YouTube IFrame quota & ad density (out of our control — mitigate with caching).
2. Edge function cold starts on `translate-subtitles` and `fetch-captions`.
3. Realtime polling in `subtitleSync` (250 ms `setInterval` per player).
4. Profile / saved_words read amplification (many small queries per page).
5. AI Gateway spend on `translate-word` (every word click is a request).

None of these require a re-platform. They need caching, batching, and a few indexes.

---

## Current architecture

```
React 18 + Vite (SPA)
   │
   ├── Supabase JS client  ──► Postgres (RLS)
   │       tables: profiles, films, subtitles, saved_words,
   │               user_lessons, activity_log, xp_events,
   │               core_vocabulary, starter_decks, ...
   │
   ├── Edge Functions:
   │     • fetch-captions       (YouTube XML + tlang proxy)
   │     • translate-subtitles  (Lovable AI Gateway)
   │     • translate-word       (Lovable AI Gateway)
   │     • youtube-search       (YouTube Data API)
   │     • auth-email-hook, process-email-queue
   │
   ├── Storage: avatars (public bucket)
   └── 3rd-party: YouTube IFrame Player, ManyChat
```

State layers: `LanguageContext` (UI lang), `XpContext` (optimistic XP), `TourContext` (onboarding overlay), local component state, and Supabase as source of truth. The SRS refactor already collapsed flashcard updates onto a single Supabase write path with optimistic UI.

---

## Scaling checklist (do these to comfortably serve 1k)

### Database
- [ ] **Add indexes** (single migration, ~30 s downtime):
  - `saved_words (user_id, next_review_at)` — flashcard due query
  - `saved_words (user_id, status)` — deck counts
  - `activity_log (user_id, day)` — calendar
  - `xp_events (user_id, created_at desc)` — recent gains
  - `subtitles (film_id, language)` — already PK? confirm
- [ ] **Connection pooling**: already on PgBouncer transaction mode via Supabase. Don't open new clients per request — reuse the singleton in `src/integrations/supabase/client.ts`. ✅
- [ ] **RLS sanity pass**: every `public.*` table has policies + GRANTs (done). Run `supabase--linter` monthly.
- [ ] **Replace per-row `.single()` reads with one batched select** on Browse/Flashcards mount (profile + xp + streak in one call).

### Edge functions
- [ ] **Cache `fetch-captions` responses** keyed by `videoId+lang` in a `caption_cache` table or in Supabase Storage. Currently we hit YouTube every time. At 1k users this will get rate-limited.
- [ ] **Cache `translate-word`** results in `word_translation_cache (word, lang_from, lang_to)`. Same word from 50 users = 1 AI call.
- [ ] **Cache `translate-subtitles`** by `film_id+target_lang` (already partially in `subtitles` table — confirm we never re-translate the same film).
- [ ] **Cold start mitigation**: keep functions warm via a 5-min cron `SELECT 1` ping for the hot ones (`fetch-captions`, `translate-word`).

### Client
- [ ] **Stop the 250 ms `setInterval`** in `subtitleSync` — switch to `requestAnimationFrame` with throttling. Eliminates ~4 wakeups/sec/tab.
- [ ] **Lazy-load admin route** (`/admin`) with `React.lazy` — non-admins never download it.
- [ ] **Code-split heavy pages** (`Watch`, `Flashcards`) — current bundle likely > 500 KB.
- [ ] **Image CDN**: avatars bucket is fine; add `?width=128` transform via Supabase image-resize for thumbnails.
- [ ] **Service-worker offline cache** for the SPA shell (later, nice-to-have).

### AI cost control
At 1k MAU × ~50 word clicks/day × $0.0001/call = ~$5/day uncached → **~$0.50/day with cache**. Caching is the single highest-ROI change.

### Observability
- [ ] Add a `client_errors` table + global `window.onerror` reporter — currently we rely on Lovable's runtime-error capture only.
- [ ] Enable Postgres slow query log review weekly (`supabase--slow_queries`).
- [ ] Add a tiny `/health` edge function pinged by uptime monitor.

---

## What is NOT a concern at 1k
- Supabase free/pro DB can handle 1k DAU easily (we're nowhere near 60 connections).
- React rendering — the app is light.
- Storage — avatars are tiny.
- Auth — Supabase auth scales to millions; HIBP check is cheap.

---

## When to re-architect (≥ 10k DAU)
- Move subtitle JSON to S3/CDN (Postgres rows are fine until then).
- Read-replica for leaderboards.
- Dedicated worker for SRS rescheduling jobs.
- Move XP writes to a queue (debounced) instead of per-event inserts.

---

## Friends / leaderboard system (added this iteration)
- Usernames + 8-char `friend_code` on `profiles` (unique).
- `friendships(user_id, friend_id, status)` with symmetric reads via SECURITY DEFINER `are_friends()`.
- Leaderboard reads: `get_friends_leaderboard()` (ranks accepted friends + self by `xp_total`) and `get_global_leaderboard()` (top 100, opt-in via `show_on_global_leaderboard`).
- Shareable invite link: `/?addFriend=CODE` — pending friend request on visit.
- Email invite: client-side `mailto:` for now; switch to Lovable Emails once domain is set up.

This system is fully decoupled from SRS and XP write paths — it only **reads** `profiles.xp_total`.
