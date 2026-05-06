## Scope this turn

1. **Custom catalog rows + pinning** (admin)
2. **Fix privacy leak** — stop publishing user-pasted videos to public catalog
3. **Google sign-in**
4. **YouTube search** (Discover tab) — uses existing `YOUTUBE_API_KEY`

Deferred: importing a user's personal YouTube playlists (needs per-user Google OAuth with `youtube.readonly` scope and Google app verification — separate follow-up).

---

## 1. Catalog rows

**New tables**
- `catalog_rows` — `id`, `title`, `sort_order`, `created_at`. Public read; insert/update/delete restricted to admins (uses existing pattern — for now: anyone can manage, matching how `films` already works, since admin route is hidden).
- `catalog_row_films` — `row_id`, `film_id`, `sort_order`. Same access pattern.

**Admin UI** (`Admin.tsx`)
- New "Catalog Rows" section above the Films list
- Create row (title input + add button)
- For each row: rename, delete, list of pinned films with up/down/remove buttons, and a "+ Add film" dropdown showing all `films` not already in that row

**Browse home** (`Browse.tsx`)
- Replace the single hard-coded "From the Catalog" strip with one horizontal strip per `catalog_rows` row, in `sort_order`
- Each strip queries `catalog_row_films` joined with `films`
- Keep "Your Lessons" at the top exactly as-is

## 2. Privacy fix

Currently `Browse.createLesson` (line 208) inserts every user-pasted YouTube video into the public `films` table, so every other user sees it under "From the Catalog".

**Change:** drop the `films` insert from the user paste flow entirely. Lesson rows live only in `user_lessons` (already private via RLS). For subtitle storage we still need a `films.id` FK, so:
- Add `is_public boolean default false` to `films`
- User-paste flow: still creates a `films` row (needed for the subtitles table) but with `is_public = false`
- Admin-added films: `is_public = true`
- Browse "From the Catalog" / new rows query `films.is_public = true` only
- Backfill: mark any `films` row that exists in someone's `user_lessons` (and was never touched by admin) as private. Concretely: set every existing `films` row to `is_public = false`, then the admin can flip the ones they actually curated back to public from the dashboard. (Cleanest given we can't tell apart admin-seeded vs user-seeded today.)

Tighten RLS on `films`: public can SELECT only `is_public = true`. Authenticated users can SELECT their own private films via a join through `user_lessons` — implemented as a SECURITY DEFINER function or a second policy `EXISTS (select 1 from user_lessons where user_lessons.user_id = auth.uid() and user_lessons.youtube_id = ...)`. Simpler: add `created_by uuid` to films and policy `is_public OR created_by = auth.uid()`.

Also lock down `films` insert/update/delete — currently `public` can do anything. Switch to `authenticated`, with `created_by = auth.uid()` for inserts. Admin ops keep working because the admin is a logged-in user.

## 3. Google sign-in

Use Lovable Cloud managed Google OAuth via `configure_social_auth` tool. Update `Auth.tsx` to add a "Continue with Google" button using `lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/browse" })`.

## 4. YouTube search (Discover tab)

New edge function `youtube-search` that proxies `https://www.googleapis.com/youtube/v3/search` using the existing `YOUTUBE_API_KEY` secret. Add a search box at the top of the Discover tab; results render as cards; click → calls existing `createLesson` flow with the URL.

---

## Out of scope (explicit)

- **Netflix, BBC iPlayer, Disney+, Channel 4** — no public APIs; content is DRM-protected. Cannot be integrated into a hosted web app. Not a Lovable limit, an industry one.
- **YouTube playlist import** — deferred. Needs per-user OAuth + Google app verification.

---

## Approve to ship?
