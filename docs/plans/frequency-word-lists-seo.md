# Most-common-words lists: free SEO lead magnet

> **Status:** plan (November 2026). **One sentence:** free, fast, honest "most common [language] words" pages (top 100 / 1,000 / 3,000) that rank on Google, prove the Zipf idea with real numbers, and send learners into LinguaScript flashcards and videos.

---

## 1. Audit: what we already have

| Asset | Where | Use for this |
|---|---|---|
| Zipf explainer + coverage table | `/frequent-words` (`src/pages/FrequentWords.tsx`) | Every list page links here ("why frequent words first") |
| English top 100 with audio, "I know it", flashcards | `/english/a1/words` (`src/lib/english/a1/words.ts`) | **The template** for the list rows |
| Frequency-list pipeline | `scripts/build-instant-dict.mjs` (FrequencyWords / OpenSubtitles 2018, CC BY-SA 4.0, + Google meanings) | Same source, any language, with counts |
| Cleaning rules (look-alikes, grammar words) | `scripts/instant-dict-fixes.mjs` | Reuse for French; pattern for others |
| "Most common words" flashcard deck | `/flashcards/common` (`CommonWordsDeck`) | The CTA destination ("turn this list into flashcards") |
| Top 10,000 per language in the DB | `public.word_dictionary` (seed-dictionary) | Meanings cross-check |
| Domain verified in Google Search Console | `google-site-verification` TXT on Cloudflare | Submit the new sitemap |

**Gaps that matter for SEO:**
1. **No prerendering.** The site is a single-page React app: Google gets an empty `index.html` and must run JavaScript to see the words. For bulk list pages that is slow and less reliable. **Fix: generate these pages as plain static HTML at build time** (section 5).
2. **`/english/a1/words` is the only list.** There is nothing for Spanish, French and the other languages.
3. **Sitemap** is regenerated only by `npm run build`, but Cloudflare runs `npx vite build`. **Commit the updated `public/sitemap.xml`** with every batch.
4. **Cloudflare is not deploying new commits right now** (last deploy 13 Nov). Fix that before publishing.

**Keyword data:** the Semrush account had **no API units** when checked, so there are **no search volumes in this plan**. Add units at https://www.semrush.com/mcp-access, then run section 7's keyword check before choosing wave 2.

---

## 2. Real numbers for every page (measured, not guessed)

Share of all word uses in the FrequencyWords 50k list (film/TV subtitles, OpenSubtitles 2018). Word *forms*, not dictionary headwords, so real coverage of headwords is a bit higher.

| Language | Top 100 | Top 500 | Top 1,000 | Top 3,000 |
|---|---|---|---|---|
| Spanish (es) | 51.9% | 70.3% | 76.7% | 85.8% |
| French (fr) | 57.7% | 75.0% | 80.8% | 88.6% |
| German (de) | 52.9% | 73.3% | 79.8% | 88.1% |
| Italian (it) | 48.0% | 69.2% | 76.4% | 85.9% |
| Portuguese (pt) | 50.9% | 70.2% | 76.8% | 85.9% |
| English (en) | 59.0% | 78.1% | 83.8% | 91.0% |
| Chinese (zh_cn) | 46.8% | 65.4% | 72.3% | 82.3% |

Each page states its own number in the title area: *"These 100 words are 51.9% of everything said in Spanish films and TV."* That is unique, factual content Google and readers value. Recompute with the build script; never hand-edit.

Source coverage: **Japanese is not in FrequencyWords** (needs another open list). **Korean is weak** (words + particles counted as one, e.g. 내가).

---

## 3. Which pages, and how many now

### Wave 1: now (19 pages)
Six languages with good data and Latin script (plus English for the EFL audience):

| Page | URL | Target searches (patterns) |
|---|---|---|
| Hub | `/words` | "most common words in [language]", "frequency list" |
| Top 100 | `/words/spanish` (also the language hub) | "most common spanish words", "100 most common spanish words", "basic spanish words" |
| Top 1,000 | `/words/spanish/top-1000` | "1000 most common spanish words", "spanish frequency list" |
| Top 3,000 | `/words/spanish/top-3000` | "3000 most common spanish words", "spanish vocabulary list" |

× Spanish, French, German, Italian, Portuguese, English = **18 + hub = 19 pages**.
`/english/a1/words` stays; `/words/english` links to it for the A1 course.

### Wave 2: after Search Console shows impressions (about 4 weeks)
- **Chinese** top 100/1,000/3,000 with **pinyin** (needs a pinyin step and a check of the subtitle word splitting).
- **EFL pages in the learner's own language** (the teacher/EFL direction): "palabras más comunes en inglés" (es), "palavras mais usadas em inglês" (pt), "mots anglais les plus courants" (fr), "最常用的英语单词" (zh), "الكلمات الإنجليزية الأكثر استخداما" (ar). Same English data, page text and meanings in that language, `hreflang` links between versions. 5 languages × 2 pages = 10.

### Wave 3
- Japanese (new open source + readings), Russian, Dutch, Turkish, Polish, Arabic.
- **Most common verbs / nouns / adjectives** per language. Needs part-of-speech data (`public.word_forms` / UniMorph), so it can't be faked from a raw list.

**Why not 30 languages at once?** Thin, near-identical pages get ignored or treated as low quality. Six strong pages-sets with real numbers, clean lists and good internal links beat thirty weak ones. Grow when Search Console shows which ones get impressions.

---

## 4. What every page contains (one template)

1. **H1:** "The 100 most common Spanish words" (or 1,000 / 3,000).
2. **The number:** "These 100 words are 51.9% of everything said in Spanish films and TV." Plus a mini table: top 100 / 1,000 / 3,000 coverage, linking to the other two pages.
3. **Why it works (short):** Zipf's law in two sentences + link to `/frequent-words`.
4. **The list:** rank · word · meaning in English · 🔊 listen (browser voice) · on the 100 page also an example sentence. 1,000 and 3,000 pages are plain fast tables, in sections of 100 with jump links (1–100, 101–200…).
5. **CTA (twice: after row 20 and at the end):** "Turn this list into flashcards" → `/auth?next=/flashcards/common` (sets the learning language) and "Watch [Spanish] videos where you know 95% of the words" → `/discover`.
6. **FAQ (3 questions, FAQPage JSON-LD):** How many words do I need? Are these words or word forms? Where does the list come from?
7. **Method + credit:** "Built from OpenSubtitles 2018 via FrequencyWords (CC BY-SA 4.0). Names removed. Meanings machine-translated; the top 100 checked by hand." The list data on the page is shared under CC BY-SA 4.0 (the licence requires it).
8. **Links:** the other two sizes, the other languages, `/english/exams` (study abroad), `/english/a1` on English pages.

**Honesty rules:** no invented percentages (always from the build script), never call a word list a course or a certificate, disclose machine translation.

---

## 5. How to build it (fast, cheap, crawlable)

- **Data (committed, built once):** `scripts/build-word-lists.mjs <lang>` downloads the 50k list, cleans it (drop names, numbers, single letters, profanity list, apostrophe fragments; keep grammar words), keeps the top 3,000 with counts, adds English meanings (official Google Translate API when `GOOGLE_TRANSLATE_API_KEY` is set, else the same fallback as build-instant-dict), computes coverage, and writes `src/data/wordlists/<lang>.json`. Commit the JSON so builds never depend on GitHub or Google being up.
- **Static pages:** a small Vite plugin (`closeBundle`) renders `/words/**` to **plain HTML** in `dist/words/.../index.html` from that JSON and one HTML template. Real text in the HTML, own `<title>`, meta description, canonical, Open Graph, JSON-LD (ItemList + FAQPage + BreadcrumbList), site CSS linked, tiny inline script for 🔊 and the CTA. **No React on these pages**: instant load, zero JS needed to read them. Cloudflare serves static files before the app fallback, so `/words/...` gets the HTML and everything else stays the SPA.
- **Because it runs inside `vite build`, Cloudflare's build command doesn't change.**
- **Sitemap:** add the URLs in `scripts/generate-sitemap.ts`, run it, commit `public/sitemap.xml`. Submit in Search Console.
- **Links in:** footer ("Most common words"), `/frequent-words`, `/english/a1/words`, the A1 hub, the blog.
- **Analytics (after consent only):** `word_list_viewed`, `word_list_cta_clicked`.

---

## 6. Success numbers

- Week 1: 19 pages live, indexed in Search Console.
- Week 4: impressions on at least half the pages → start wave 2 with the best languages.
- Week 8: CTA click-through ≥ 3%, first sign-ups attributed to `/words`.

---

## 7. Keyword check (when Semrush has units)
For each language: volume + difficulty for "most common X words", "100/1000/3000 most common X words", "X frequency list", "X vocabulary list", "basic X words", "most common X verbs"; and for EFL: the localized phrases in section 3. Pick wave 2 by volume ÷ difficulty.

---

## 8. Build prompt: wave 1 (paste to Claude Code)

```
Read AGENTS.md and docs/plans/frequency-word-lists-seo.md first.

Build wave 1 of the most-common-words pages: languages es, fr, de, it, pt, en.
1. scripts/build-word-lists.mjs <lang>: download
   https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/<lang>/<lang>_50k.txt,
   clean it (drop names, numbers, single letters except real words, profanity,
   apostrophe fragments; reuse scripts/instant-dict-fixes.mjs for fr), keep the
   top 3000 with counts, add English meanings (non-English) the same way as
   scripts/build-instant-dict.mjs, compute coverage for 100/500/1000/3000 from
   the counts, write src/data/wordlists/<lang>.json with source + licence
   fields. Run it for all six and commit the JSON.
2. A Vite plugin (closeBundle) that renders static HTML from that JSON into
   dist/words/index.html, dist/words/<language>/index.html (top 100),
   .../top-1000/index.html, .../top-3000/index.html, following plan section 4
   exactly (H1, real coverage number, Zipf link, table with 🔊 via
   speechSynthesis, CTA twice to /auth?next=/flashcards/common and /discover,
   3-question FAQ, method + CC BY-SA credit, links to the other sizes and
   languages). Own title/description/canonical/OG + JSON-LD ItemList, FAQPage,
   BreadcrumbList. Link the site's built CSS; no React on these pages.
   Lighthouse-light: no images except the SVG logo.
3. Add all 19 URLs to scripts/generate-sitemap.ts, run it, commit
   public/sitemap.xml. Add "Most common words" links in the marketing footer,
   /frequent-words and /english/a1/words.
4. Analytics events word_list_viewed / word_list_cta_clicked through
   src/lib/analytics.ts (consent rules unchanged).
5. Check: npx vite build passes, dist/words/spanish/index.html contains the
   word list as plain text, and the SPA still works for every other route.
   Screenshot one page on phone and desktop.
Commit on the current branch, open a PR, and list any word you removed and why.
```
