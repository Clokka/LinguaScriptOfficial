# LinguaScript: what we are, for whom, and how it fits together

> **Source of truth** for positioning, value proposition, the lesson shape and what to simplify (November 2026). Read this before writing copy, adding a feature or redesigning a screen. Brand colours stay in `brand/README.md`; the review ladder stays in `packages/core/src/review.ts`.

---

## 1. The one sentence

**LinguaScript teaches you the words that matter most first, then lets you hear them in videos you love, and use them by speaking and writing, one short guided lesson a day.**

Shorter, for headlines:
- *"The 100 words behind half of everything people say. Then the next 900, inside the shows you love."*
- *"Learn the words that matter. Hear them in real videos. Use them."*

**What we are not:** another "learn with Netflix" subtitle tool. That market is crowded (Language Reactor, Migaku, LingQ and others). Films are our *input*, not our identity.

---

## 2. Why this position (and how to talk about it honestly)

- **The science is simple and true:** word use follows Zipf's law. In our own film/TV measurements, the top 100 words are about half of everything said (Spanish 51.9%, French 57.7%, German 52.9%, Italian 48%, Portuguese 52.4%, English 54.8%) and the top 1,000 about three quarters. Numbers come from `src/data/wordlists`, never typed by hand.
- **Comprehensible input** (understand ~95–98% of what you hear) is how words stick; **output** (speaking, writing) is how they become yours. See `/learn`.
- **Our difference is the combination, delivered as a guided course:** frequency order + real videos at your level + output, personalised to your goal, hobby and date, self-paced or with a teacher.
- **Don't say "the first" or "the only"** unless we can prove it: UK advertising rules (ASA/CAP) need evidence for such claims, and others use frequency lists with input in parts. Say what we *do*: "built around", "every lesson starts with", "the course that…".
- Market growth claims (e.g. "comprehensible input is growing") need a source before they go in copy.

---

## 3. Who it's for (one primary ICP at a time)

| | **Primary now: the guided beginner** | Second: the online English teacher | Later |
|---|---|---|---|
| Who | Adult (16+) beginner or "stuck" learner, A0–A2. Tried apps, can't follow real speech, wants someone to tell them what to do each day | Freelance EFL teacher with 10–40 students (persona Laura) | Parents of teens, schools, anime fans (once Japanese is solid) |
| What they want | "Tell me exactly what to learn today, and show me it's working" | Homework that's done, less prep, proof of progress | |
| Our promise | **A course built for you: 10 minutes a day, frequent words first, in videos about what you love** | **Any clip becomes a lesson; your students' courses follow your class** | |
| Course pace | Self-paced or to a date | Paced with the teacher (class code) | |

Personas and details: `docs/LinguaScript_Buyer_Personas_ICPs.pptx`. Run **one funnel** (the guided beginner) for 90 days before spending time on the others.

---

## 4. The method: three steps (the Chameleon Method, after Kató Lomb)

| Step | Lomb's pillar | What the learner does | Colour |
|---|---|---|---|
| **1. Learn** the words that matter | (structure) | Frequency-ordered words + one sentence pattern a day | 🔴 red = new |
| **2. Watch** them for real | 📖🎬 read + watch (input) | Videos, films, podcasts and reading at ~95–98% known words | 🟠 orange = learning |
| **3. Use** them | ✍️ write + 🗣️ speak (output) | Say it to a coach, write a few lines, record a video | 🟢 green = known → 🟡 gold review → 🔵 blue = 100% known |

**Every screen should make it obvious which step you're in.** The five colours mean word states only; green is also the main button colour.

---

## 5. The lesson shape (every daily lesson, 5–20 minutes)

Based on a classic teaching lesson (warmer → presentation → practice → production → plenary):

| # | Step | What happens | Reuses |
|---|---|---|---|
| 1 | **Warm-up** (1 min) | Quick review of today's gold words | Review ladder, flashcards |
| 2 | **New words** (2 min) | Pre-teach 5–8 frequency words for this lesson, with audio and a picture or example | Word lists, instant dictionary |
| 3 | **Practice** (2 min) | Gap fills and pattern swaps ("¿Dónde está ___?") in context | Sentence patterns, Fast Track drill format |
| 4 | **Watch** (3 min) | A short clip in the learner's hobby containing the target words/pattern; tap words; counter shows each target word heard | Player, coverage (95–98%), hobby catalogue |
| 5 | **Wrap-up: use it** (2 min) | One of: speak to the AI coach using 2 new words · write 3 lines (LinguaScripts) · record a 90-day-challenge video in Video Studio · scan a page you're reading | /speak, /write, /studio, Scan a page |

Using a new word correctly in step 5 counts as a review (red → orange). Mock-ups: the onboarding canvas, screens 14 (Today) and 15 (Watch).

---

## 6. Product map: core vs helpers

**Core (what we sell, inside the course):** the personalised course · daily lessons (section 5) · the player with coloured dual subtitles · flashcards on one review ladder.

**Helpers (they make it work everywhere; mention them second, as "and it follows you"):**
- Chrome extension: coloured words and tap-to-save on YouTube, Netflix, Crunchyroll, TV5MONDE, and any website (Alt+L)
- Android: 🦎 bubble, tap YouTube subtitles, highlight → **Add to LinguaScript**, Share → LinguaScript, widgets and lock-screen gold words
- Scan a page of a real book
- ChatGPT / Claude connector (MCP)
- Google Calendar (lesson times, homework due dates)
- Export to Anki / Quizlet
- Free SEO tools: word lists, /learn articles

**Rule:** the homepage and app store lead with the core promise and three proof points. Helpers go in one "Works everywhere you read and watch" section, never in the headline.

---

## 7. Messaging hierarchy (homepage, store listing, ads)

1. **Headline:** the promise (section 1).
2. **Sub-line:** "A course built for you: 10 minutes a day, the most common words first, in videos about what you love."
3. **Three proof points:** "100 words = about half of real speech" · "Videos you'll understand 95% of" · "Speak and write with your new words every day".
4. **How it works:** Learn → Watch → Use, with the red → green colours.
5. **What a lesson looks like:** the 5 steps.
6. **Works everywhere:** the helpers.
7. **Trust:** /learn research, real learner stories, founder story, free word lists.
8. **One button:** "Build my course".

---

## 8. Simplify: product and code

**Navigation (4 tabs in the app):** **Today** (the course) · **Watch** (library, search, paste a link) · **Words** (decks, scan, export) · **Me** (progress, settings, classes). Everything else is reached from these.

**Hide or merge:** old landing variants not in the live test, duplicate onboarding (`OnboardingMobile.tsx` Figma frames), "Explain", "Story" duplicates, rarely used admin links in user menus. Write/Speak return *inside* lesson step 5, not as separate menu items.

**One look (UI consistency):**
- Colours only from `brand/README.md`: background `#0B0B0D`, cards `#131316`, lines `#1E1E23`, text `#F2F2F5`, muted `#A1A1AA`; red/orange/green/gold/blue = word states; green = main action.
- One component kit: `src/components/premium` (+ the static pages' styles for SEO pages). No one-off card styles.
- Remove leftover indigo/purple and gradient tokens that don't match the brand.

**Code diet (keep the features, cut the weight):** the biggest pages are `Watch.tsx` (1,837 lines), `Browse.tsx` (1,409), `Admin.tsx` (871), `Onboarding.tsx` (703). Split each into small parts (player, subtitles, word card, side panels) and delete dead code paths (old experiments, unused variants). Target: no page over ~400 lines; every split keeps behaviour identical, checked with `npx vite build` and a screenshot before/after.

---

## 9. Order of work

1. **Agree this framework** (Rowan).
2. **Copy pass:** homepage hero, app store listing, onboarding text, using section 7.
3. **Course engine + new onboarding** behind an A/B test (`docs/plans/personalised-course-paywall.md`).
4. **Today screen + lesson player** (section 5), reusing existing pieces.
5. **Navigation to 4 tabs + UI consistency pass** (section 8).
6. **Code diet**, one big page per PR, starting with `Watch.tsx`.
7. **Teacher course pacing + Google Calendar** (`docs/plans/teacher-calendar-automations.md`).
8. **Wrap-up step extras:** AI coach conversation, 90-day challenge video flow.

---

## 10. Open decisions for Rowan

- Final headline wording (section 1 options, or your own).
- Is the primary ICP "adult guided beginner" (recommended), or a narrower group (e.g. "adults learning Spanish for travel")? Narrower = easier ads and SEO.
- What stays free once the paywall arrives (see the paywall plan).
- Name for the AI coach in the wrap-up step.
