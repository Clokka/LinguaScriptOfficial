# LinguaScript SEO: research findings + build plan

Data below is from Semrush (UK and US databases — your `.co.uk` audience is UK, but almost all volume in this niche is US, so I checked both).

## 1. Where you stand today

- `linguascript.co.uk` returns **no data** in Semrush's UK index — the site isn't ranking for anything measurable yet. Normal for a new domain.
- **Language Reactor** (the incumbent) gets ~8,800 visits/mo from just 310 keywords, and **~90% of it is their own brand name plus misspellings** ("langauge reactor", "languaje reactor", "language reacotr"…). That is the single most important lesson: in this category, brand search is the traffic. Your "lingoscript" instinct is exactly right.
- Search Console isn't connected, so there's no live indexing data. Titles, descriptions and canonicals are identical on every route, there's no sitemap, and og tags are the same sitewide.

## 2. Your keywords, scored

| Term | Volume (US / UK) | Difficulty | Verdict |
|---|---|---|---|
| the chameleon method | no data | — | Zero existing demand. This is a **brand term you create**, not one you capture. Own it now so it's yours when demand appears. |
| language script | 20/mo UK | 0 | Trivial to win, near-zero traffic. Free side effect of the brand page. |
| lingoscript | no data | — | Pre-emptive misspelling capture. Cheap, and LR proves it pays off later. |
| dual subtitles | 1,300 / 90 | 15 (easy) | **Best commercial keyword you have.** High buying intent, low difficulty. Deserves its own page. |
| netflix dual subtitles | 260 | 25 | Own page. CPC $7.41 — real commercial value. |
| youtube dual subtitles | 20 | 0 | Own page, easy win. |
| spaced repetition | 5,400 / 1,000 | 52–65 (hard) | Big, but dominated by Wikipedia/Anki. Go at it via long-tails, not head-on. |
| anki alternative | 90 | 6 | Easy, high-intent, directly competitive. Add it. |
| language reactor alternative | 30 | 0 | Free win. Comparison page. |
| language acquisition device | 1,300 / 210 | 33 | Strong article opportunity (Chomsky LAD). Informational, but feeds your psychology angle. |
| comprehensible input | 2,400 | 25 (easy) | **The biggest missed opportunity in your list.** Krashen's term, exactly your product's thesis, easy difficulty, and 15+ question long-tails ("how many hours of comprehensible input", "does comprehensible input work"). |
| learn multiple languages at once | 20 | 0 | Easy; matches your new 5-language-profile feature. |
| chunking language learning | 20 | 0 | Easy article. |
| polyglot plan / family plan / teacher dashboard | no data | — | No search demand. Build as conversion pages, not SEO pages. |
| chrome extension language learning | ~0 | 0 | Low direct volume; the traffic here comes from the Chrome Web Store listing, not Google. |

**Gaps you didn't list but should own:** comprehensible input (+ its question long-tails), anki alternative, language reactor alternative, "learn language with netflix" cluster, GCSE/A-Level French vocabulary (tiny volume but perfectly matched to your actual audience and near-zero competition).

## 3. Strategy in one line

Two engines: **(a)** a small set of high-intent product pages targeting dual-subtitle / alternative-to searches, and **(b)** an educational-psychology blog cluster (comprehensible input, LAD, chunking, spaced repetition) that pulls in learners and links back to the product. Everything routes through "The Chameleon Method" as the branded name for what you do.

## 4. What I'll build

### Phase 1 — Technical foundation (blocking everything else)
- Install `react-helmet-async`; add a `<Seo>` component so every route gets its own title, description, self-referencing canonical and og tags.
- Generate `public/sitemap.xml` from the route list plus published blog posts (`scripts/generate-sitemap.ts`, wired to `predev`/`prebuild`).
- Add `WebSite` + `SoftwareApplication` JSON-LD alongside the existing Organization block.
- Connect Google Search Console, verify `linguascript.co.uk`, submit the sitemap.
- Fix the H1/aria-label accessibility gaps the last scan flagged.

### Phase 2 — Blog engine (admin-authored)
- `blog_posts` table: slug, title, excerpt, body (markdown), cover image, meta title/description, tags, status, published_at, author. RLS: public reads published rows only; admins write.
- Admin editor in `/admin`: markdown editor with live preview, SEO fields (title/description/slug with character counters), draft/publish toggle, post list.
- Public `/blog` index and `/blog/:slug` post pages, with `Article` + `BreadcrumbList` JSON-LD, related posts, and a CTA into the app.
- Posts feed the sitemap automatically.

### Phase 3 — Landing pages (one per intent)
1. `/the-chameleon-method` — the flagship brand page (upgrade the existing route). Explains the method, targets the brand term, links to everything.
2. `/dual-subtitles` — the money page.
3. `/dual-subtitles/netflix` and `/dual-subtitles/youtube`.
4. `/vs/language-reactor` — honest comparison, targets "language reactor alternative".
5. `/anki-alternative` — spaced repetition built in, no export needed.
6. `/for-schools` — teacher dashboard and school sign-in (conversion page).
7. `/chrome-extension` — install page + Chrome Web Store link.
8. `/polyglot` and `/family` — offer pages, indexable but not SEO-targeted.
9. `/story` — the LinguaScript story.

### Phase 4 — Article cluster (seeded as blog posts, editable by you)
Ordered by opportunity:
1. What is comprehensible input? (2,400/mo, easy) — plus the question long-tails as sections.
2. The language acquisition device explained (1,300/mo).
3. Spaced repetition for language learners — long-tail angle, not the head term.
4. Learning languages in chunks.
5. Learn multiple languages at once.
6. Language learning with educational psychology / learn 10x faster.
7. The LinguaScript system explained.
8. LinguaScript comprehension tracking explained.

Each article ends with a link into the relevant product page.

## 5. Honest caveats

- The app is client-rendered, so social-preview crawlers (LinkedIn, Slack, Facebook) only see the static head, not per-route tags. Googlebot handles it fine. If accurate per-page social previews matter, the app can get server rendering by upgrading to Lovable's latest template — type "/" in chat and choose "Migrate to TanStack Start" ([what the upgrade gives you](https://lovable.dev/blog/building-apps-using-tanstack-start)).
- "The Chameleon Method", "polyglot plan" and "family plan" have no search demand today. Build them for positioning and conversion; don't expect traffic from them for months.
- New domains typically take 3–6 months to rank. The easy-difficulty terms (dual subtitles, anki alternative, language reactor alternative) will land first.

## 6. Where to start

I'd do Phase 1 + Phase 2 first (foundation and blog engine) so you can start writing while I build the landing pages. Say the word and I'll begin.
