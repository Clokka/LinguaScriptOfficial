# Landing page + funnel plan (November 2026)

> Read with `docs/POSITIONING.md` (what we say) — this file is *where* we say it.
> Built so far: `/landing6` (the interactive "Films you'll actually understand" page).

## 1. The short answer

**One page cannot do everything, and it shouldn't try.** People rarely buy on their first visit. They come back several times from different places (search, TikTok, a friend, an email) before they sign up. So:

- The **homepage** has one job: make the promise clear in 5 seconds, *let them feel it* (the interactive fan), and give one button.
- **Every feature, the science and the buyer's questions** live on other pages (the funnel), each answering *one* question, each linking to the next step.
- The **buyer persona is never written on the page** ("you are a 25-year-old…"). It shows up as *their own words*: their pain ("real people talk too fast"), their hobby (the fan), their level ("beginner or stuck").

## 2. What the research says (and how sure we can be)

| Finding | Source | How solid |
|---|---|---|
| Buyers use several channels before buying: in one agency dataset 65% of consumers used 5+ platforms before a significant purchase; only 3.7% used one | NP Digital via [neilpatel.com](https://neilpatel.com/marketing-stats/modern-customer-journey-multi-platform/) | Agency client data, not independent |
| "It takes N touchpoints" numbers range from 1 to 50 depending on the buyer | [EmailToolTester](https://www.emailtooltester.com/en/blog/how-many-touchpoints-before-a-sale) | The famous "7" or "8" is folklore — don't quote a number |
| Visitors who used an interactive demo converted 63% more than those who didn't (24 B2B SaaS sites) | HockeyStack via [hockeystack.com](https://hockeystack.com/lab-blog-posts/do-interactive-demos-work) | Small sample, vendor, and engaged visitors were already keener |
| Median SaaS landing page converts ~3.8% (Unbounce 2025) | via [saashero.net](https://www.saashero.net/google-ppc/landing-page-performance-benchmarks/) | Sources disagree; use our own numbers as the benchmark |
| Trust comes from: good design, upfront disclosure (price, who we are), current + complete content, links to the wider web | Nielsen Norman Group, summarised e.g. [here](https://www.nngroup.com/videos/website-credibility/) | Long-standing, widely replicated |

**What we take from it:** make the homepage *interactive and personal* (the fan), be *upfront* (free to start, founder's name, email), link to *real research* (/learn), and build *many pages* for the many visits. Then trust **our own A/B numbers** over any benchmark.

## 3. The homepage: `/landing6`

| # | Section | Why it's there |
|---|---|---|
| 1 | **Promise**: "Films you'll actually understand." + one line | 5-second test: what is it, for whom |
| 2 | **Interactive fan**: pick a hobby, pick YouTube/Netflix/Anime/News, hover = words change colour | Shows the product instead of describing it; personalises instantly; the hobby is carried into onboarding |
| 3 | **3 proof points** with "where this comes from" links | Numbers + sources = trust |
| 4 | **Pains** in the learner's words | The persona, without saying "persona" |
| 5 | **How it works**: Learn → Watch → Keep, with the colours | The Chameleon Method in 10 seconds |
| 6 | **Works everywhere** chips | Features as *helpers*, one line each (POSITIONING §6) |
| 7 | **Trust**: research links + founder + email | Upfront disclosure |
| 8 | **Questions** (FAQ) | Answers the objections before they leave |
| 9 | **One button** again | |

Rules: every claim is something the app does *today*; examples are labelled "Examples"; no "first/only"; Netflix etc. are text badges, never logos.

**Next for this page:** replace the example cards with real picks from `public.hobby_video_catalog` once it's filled (YouTube tab), and add a 10-second screen recording of a real tap → red → green.

## 4. The funnel: one question per page

| Stage | Visitor is thinking… | Pages (✅ exists, ➕ to build) | Main button |
|---|---|---|---|
| **Top** (problem-aware, searching) | "Why can't I understand native speakers?" "Most common French words" "What is comprehensible input?" | ✅ /words/&lt;language&gt; · ✅ /learn/high-frequency-words · ✅ /learn/comprehensible-input · ✅ /frequent-words · ✅ /english/a1 · ➕ "Why can't I understand native speakers?" article · ➕ "Learn French with YouTube" guide | Free word list / "I know it" game → "Try it in a video" |
| **Middle** (solution-aware, comparing) | "Is this better than Duolingo / Language Reactor?" "Does learning with films work?" | ✅ /the-chameleon-method · ✅ /vs/language-reactor · ✅ /chrome-extension · ✅ /learn/kato-lomb-chameleon-method · ➕ **hobby pages** `/learn-french-with-football` etc. (one per hobby × language, real videos from the catalog) · ➕ "LinguaScript vs Duolingo" (fair, sourced) | "See videos about *your* hobby" → homepage fan / onboarding |
| **Bottom** (ready) | "How much? Can I start now?" | ✅ homepage (/landing6) · ✅ /pricing · ✅ /onboarding · ✅ /for-schools (teacher ICP) · ✅ app store listing | Start free |

**Links always point one step down the funnel** (top → middle → bottom), plus a small "start free" everywhere.

**SEO basics for every page:** one search phrase per page in the title, H1 and URL; a description that says the answer; real text in the HTML (the static `/words` + `/learn` generator already does this); add the page to `scripts/generate-sitemap.ts`; link to it from 2+ existing pages.

**Best next build:** the **hobby pages** (`/learn-<language>-with-<hobby>`). They match how people search ("learn Spanish with football"), they show the personalised product, and the data already exists (`INTERESTS`, the hobby catalog, word lists).

## 5. How we'll know it works

- Make `/landing6` the homepage from HQ (Today → type `/landing6`), and compare **visit → Start free → finished onboarding** against the previous weeks. Better still: add it as an arm in the built-in homepage test (`src/components/landing/LandingPageTest.tsx`) for a fair split.
- Wait for ~1,000 visits per version before deciding (the HQ Results tab rule).
- Watch which fan tab and hobby people click (`cta` events carry `from=card-yt|nf|cr|tv`, `hero`, `nav`, `final`).
