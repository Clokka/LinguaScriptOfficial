# LinguaScript — Competitive Audit & Growth Plan

_Dual-subtitle / video immersion language-learning extensions. Compiled July 2026._

Source list seed: [awesome-language-learning](https://github.com/jqhoogland/awesome-language-learning)
plus market research (links at the bottom).

---

## 1. The landscape — 12 comparable products

| # | Product | Platforms | Core model | Standout architecture / feature |
|---|---------|-----------|-----------|--------------------------------|
| 1 | **Language Reactor** (the incumbent, ~2–3M users) | Netflix, YouTube | Freemium | Dual subs + **hover dictionary**, **frequency-band colour coding**, media-rich **Anki export** (screenshot + audio). Feels dated now. |
| 2 | **Trancy** | YouTube, Netflix, Udemy, Coursera (8+) | Freemium (~$3/mo) | **AI-first**: GPT grammar analysis, **scene-specific definitions**, AI example sentences + image per saved word, **AI pronunciation scoring**, speaking coach, **built-in SRS**, iOS/Android apps. |
| 3 | **Immersive Translate** | 127+ video/web platforms | Freemium | **Generic per-site adapter architecture** → huge platform reach; bilingual web pages, PDF, subtitles, meetings. |
| 4 | **Funlingo** | Netflix, YouTube, Prime Video | 100% free | No paywall, built-in vocab builder. Competes purely on "free + simple". |
| 5 | **EasySubs** | Netflix (+more) | Free & **open source** | Best code reference for robust subtitle injection; community-maintained. |
| 6 | **Migaku** | Netflix, YouTube (+browser) | Paid subscription | Immersion ecosystem: **media-rich Anki cards**, known-word tracking, frequency, parser per language. Closest to our "colour by knowledge" model. |
| 7 | **eJOY English** | YouTube, Netflix, web | Freemium | Word game reviews, clip capture, courses, in-app SRS. |
| 8 | **ReadLang** | Web reading (video-adjacent) | Freemium | Reading + **native flashcard SRS** (no Anki needed) — validates the "SRS baked in" thesis. |
| 9 | **NF Dual Subtitles** | Netflix | Free | Drag-and-drop subtitle positioning, one-click **SRT download**. |
| 10 | **Netflix Dual Subtitles Master** | Netflix | Free | **55 secondary-subtitle languages**, incl. ones Netflix lacks natively. |
| 11 | **Lingopie** | Own catalogue + extension | Subscription | Licensed content, click-to-translate, review games. Content-owner play. |
| 12 | **Sublo** | Netflix, YouTube | Freemium | Lightweight LR alternative, clean UI. |

**Two winning archetypes to steal from:**
- **Trancy** = the AI + integrated-SRS model (where the market is going).
- **Immersive Translate** = the adapter-based platform-reach model (how to be everywhere).

---

## 2. Honest audit of LinguaScript vs. the field

### Where we already win 🟢
- **Full companion web app + gamification.** Pets, XP, streaks, friends, leaderboard, LinguaScripts. Almost every competitor is an *extension only*. This is our real wedge — nobody else makes immersion feel like a game.
- **Personalised knowledge colouring.** We colour subtitle words by **your own deck state** (red/orange/green), not just generic frequency bands. Only Migaku/LR approach this, and ours is unified across web app + Netflix + YouTube via one `saved_words` keyspace.
- **Baked-in SRS.** Words flow from video → deck → flashcard review with no Anki round-trip (the ReadLang/Trancy thesis).
- **Unified brand + single backend (Supabase).** One source of truth; realtime-ish colour refresh.

### Where we're behind 🔴
| Gap | Who does it well | Impact |
|-----|------------------|--------|
| **No AI layer** — no scene-aware definitions, AI examples, grammar breakdown, pronunciation scoring | Trancy | Biggest strategic gap. Ironic — we're *built on Claude* and don't use it in the learning loop. |
| **Only 2 platforms** (Netflix + YouTube), with **fragile DOM scraping** | Immersive Translate (127+), EasySubs (robust injection) | Reach + reliability. We just hit the "subtitles vanish on reload" failure — that class of bug is a churn killer. |
| **No media-rich cards** (screenshot + audio clip at timestamp) | LR, Migaku | Weaker review; media cards dramatically boost recall. |
| **No Anki export** | LR, Migaku | Loses the power-user / SEO segment ("LR alternative that exports to Anki"). |
| **Machine translation only** (MyMemory/Google free endpoints) | Trancy (contextual AI) | Quality gap on idioms/nuance. |
| **Click-only lookup** (no hover), no frequency data for *unseen* words | LR hover + frequency bands | Slower interaction; new words are uncoloured/undifferentiated. |
| **Reliability / polish** — the bugs of the last few sessions | Funlingo (dead simple, just works) | Table stakes; must be rock-solid before growth spend. |

---

## 3. Architecture lessons worth adopting

1. **Adapter pattern for platforms (Immersive Translate).**
   Extract a `SubtitleAdapter` interface (`getActiveText()`, `observe()`, `hideNative()`, `mountOverlay()`), and make Netflix/YouTube concrete adapters. New platforms (Disney+, Prime, YouTube Shorts, Viki) become ~100-line plugins instead of forked content scripts. Today `content.js` and `youtube-content.js` duplicate logic — collapse them onto one core + adapters.

2. **Never hide native subs until the overlay is live (EasySubs pattern).**
   Root cause of our "blank screen" bug: we `visibility:hidden` the native track at script start. Gate native-subtitle hiding on "overlay has rendered text", and **restore native subs on any failure / teardown**. Add a heartbeat so an orphaned style can't strand the user.

3. **AI enrichment pipeline via Claude (Trancy's moat, but it's our home turf).**
   On word-save, call an edge function that returns: scene-aware definition, one AI example sentence, a difficulty estimate, and a short grammar note. Cache per (word, language, sense). This is a genuine differentiator we can ship fast because the app is already Anthropic-backed.

4. **Media-rich SRS cards.**
   Capture a frame (`<video>` → canvas) and a 3–5s audio clip at the subtitle timestamp when saving. Store to Supabase storage; attach to the flashcard. Optional **Anki `.apkg` export** to win power users and SEO.

5. **Frequency + difficulty data for unseen words.**
   Ship a per-language frequency list; colour *unsaved* words on a light frequency gradient so learners see "worth learning" words even before saving (LR's band idea, layered under our personal red/orange/green).

6. **Resilience & observability.**
   SPA-navigation handling (Netflix/YouTube are single-page), a small in-overlay status dot ("synced / offline / logged out"), and structured logging behind a debug flag (we just added ad-hoc logs — formalise them).

---

## 4. Growth plan — sequenced

**Phase 0 — Stop the leaks (1–2 weeks). _Do before any marketing._**
- Fix subtitle injection robustness (lesson #2) — restore native subs on failure; gate hiding.
- Finish the red/orange/green correctness work (pagination + highest-state-wins already landed; confirm with the diagnostics).
- Unify Netflix/YouTube onto one core (lesson #1 groundwork).
- Add the status dot + debug logging.
- **Goal:** zero "it broke" reviews. Reliability is the precondition for retention.

**Phase 1 — Lean into the wedge nobody else has (2–4 weeks).**
- Double down on **gamification during watching**: pet reacts to saved words, streak nudges, "turn the language green" progress bar on the video. This is our unique, defensible hook.
- Ship **AI enrichment** (lesson #3) — scene-aware definition + example on the word card. Positions us against Trancy while playing to our Claude backend.
- **Goal:** a demo that feels categorically more fun than LR/Trancy.

**Phase 2 — Close the table-stakes gaps (4–8 weeks).**
- **Media-rich cards** + **Anki export** (lesson #4) → capture the power-user segment and "Language Reactor alternative" SEO.
- **Frequency colouring** for unseen words (lesson #5).
- **Hover** quick-lookup in addition to click.

**Phase 3 — Reach (8–12 weeks).**
- Add 2–3 platforms via the adapter pattern (Disney+, Prime Video, Viki) — each is now cheap.
- Chrome Web Store optimisation + landing pages targeting "dual subtitles for [platform]" and "[competitor] alternative".

**Positioning statement to test:**
> "Language Reactor teaches you words. LinguaScript makes you *want* to come back — gamified immersion with an AI tutor built in, that turns everything you watch green."

---

## 5. Sources
- awesome-language-learning — https://github.com/jqhoogland/awesome-language-learning
- Best dual-subtitle Netflix extensions 2026 (Trancy) — https://www.trancy.org/blog/best-dual-subtitles-netflix-chrome-extension-2026-31f9d22520058055aceeef372ff871f0
- 7 Best Chrome Extensions for Language Learning (Lingopie) — https://lingopie.com/blog/best-chrome-extensions-for-language-learning/
- Dual Subtitles Extensions for Netflix & YouTube (FluentAI) — https://fluentai.pro/guides/dual-subtitles-chrome-extension
- 7 Best Dual Subtitle Extensions (Funlingo) — https://www.getfunlingo.com/blog/best-dual-subtitle-extension
- Trancy vs Language Reactor (Creati.ai) — https://creati.ai/ai-tools/trancy/alternatives/trancy-vs-language-reactor-language-learning-platform-comparison/
- Netflix Dual Subtitle alternatives (AlternativeTo) — https://alternativeto.net/software/netflix-dual-subtitle
