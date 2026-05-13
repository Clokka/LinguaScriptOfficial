## Competitive read: Speakeasy

What they do well that we should answer:
- Animated hero where the user **hovers a word and sees a translation pop** — proof of concept in 1 second.
- Step-by-step scrollytelling: **Watch → Save → Speak**, each step has a working mini-demo embedded inline.
- Per-language landing variants (Spanish / Mandarin / Japanese / French / Portuguese) with curated creator catalogues.
- Phrase-first (not word-first) framing.

What we win on (and should make obvious):
- Real YouTube playback with **dual subtitles + click-to-flashcard** in-browser — no extension, no app install.
- A-Level / school-grade CEFR curation.
- B2B-for-schools angle — they don't have it.

## Recommended next steps (in priority order)

### 1. Interactive demo inside onboarding (highest ROI)
Replace static "How Linguascript works" card in `/onboarding` (Card 2) with a real **mini-player simulator** the user must interact with to advance. Three micro-steps, each gated:

```text
[ Mini step A ]  Toggle "Dual subtitles" → second line fades in
[ Mini step B ]  Click a highlighted word ("bonjour") → popup shows translation + IPA + 🔊
[ Mini step C ]  Tap "Save to deck" → flashcard flies into a deck icon (success ding)
```

- Built with Framer Motion + a mocked subtitle line (no real YT iframe needed → instant, no ads, works offline).
- Animated finger / cursor hint after 2s of inactivity per step (Duolingo-style).
- On completion → confetti + "You just learned how Linguascript works" then continue.

This is the **single biggest conversion lever** — copies their best pattern but applied to our actual feature.

### 2. Language-specific catalogues
Driven by `profiles.learning_language` chosen in onboarding.

Schema additions:
- `films.tags text[]` (e.g. `{"creator:InnerFrench","beginner"}`)
- `catalog_rows.language text` (nullable = global; else filter)
- Optional: `catalog_rows.cef_levels text[]` for level-targeted rows

Browse logic: only render rows where `row.language IS NULL OR row.language = profile.learning_language`.

Seed catalogues per language with curated YouTube channels:
- 🇨🇳 Mandarin: Mandarin Corner, Lazy Chinese, Mandarin Click
- 🇫🇷 French: InnerFrench, Français avec Pierre, Piece of French
- 🇪🇸 Spanish: Dreaming Spanish, Españolistos
- 🇩🇪 German: Easy German, Deutsch mit Marija
- 🇯🇵 Japanese: Nihongo con Teppei, Comprehensible Japanese

Admin gets a per-language tab to manage rows.

### 3. Pre-roll ads while video loads
On click of a video card → route to `/watch/:id`, show a **15s ad slot** before the YouTube iframe mounts. Ad types supported:
- House promo (free) — rotating Linguascript "Did you know?" cards (animated).
- Real ads — wire in **Google AdSense / EzoicAds** later. For now, build the slot with a `Skip in 5s` countdown so the surface is ready.

```text
[Watch route]
  ├─ AdLoader (15s, skippable after 5s) ── while we prefetch subtitles + iframe
  └─ Player mounts when ad ends OR skip pressed
```

This also masks YouTube iframe load latency — perceived perf win.

### 4. B2B / schools positioning (light pass now, deeper later)
Add a `/schools` route linked from the footer + a small "For Schools" pill in the top nav:
- Headline: "Free for A-Level & GCSE classrooms."
- Form → captures school name, teacher email, # students into a new `school_signups` table.
- "Class accounts coming soon" — sets up the eventual paid plan upgrade path.

Don't build the actual class-management product yet; capture demand first.

### 5. Marketing-style hero refresh on `/` (optional, smaller)
Add a **"Try to hover"** mini interactive subtitle to the landing hero so first-time visitors see the magic before clicking anything (mirrors Speakeasy's hook). Low effort, high signal.

## Suggested build order

1. Interactive demo onboarding (Step 1) — ~1 build cycle
2. Pre-roll ad slot on `/watch/:id` (Step 3) — ~½ cycle
3. Language-specific catalogues + admin filter (Step 2) — ~1 cycle (includes migration + seed data)
4. `/schools` lead-capture page (Step 4) — ~½ cycle
5. Landing hover-demo (Step 5) — ~½ cycle

## Out of scope (not now)
- AI voice tutor / speaking practice (Speakeasy's Step 3) — different product surface, defer.
- Real ad-network integration (just the slot + house ads for now).
- Full school admin dashboard / paid plans.

## Question before I build
Which should I ship first — **(A) the interactive onboarding demo** (biggest conversion lever) or **(B) the language-specific catalogues** (needed before you onboard non-French users)?