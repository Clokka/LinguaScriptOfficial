# LinguaScript organic acquisition audit

22 November 2026 · Live website: https://linguascript.co.uk · UK-first research, with named US comparisons.

## Decision in brief

**Make the French frequency lists the first acquisition funnel.** Improve the existing top-100 and top-1,000 pages before producing dozens of new articles. Add a useful top-50 page next, with meanings, audio, examples and a clear next step. Then create practical French comprehensible-input guidance. Keep alternative-tool comparisons as a small, high-intent supporting cluster, not the main traffic bet.

The product already has strong raw material: six language frequency datasets, public static word-list pages, Anki downloads, cited method articles, a subtitle player and word review. The problem is not simply a missing sitemap: Google has not yet indexed the two non-brand pages inspected here.

**No rankings, signups or revenue are guaranteed.** This audit recommends the next work; it does not create new SEO pages or change the homepage.

## 1. Search Console is connected and your sitemap is healthy

Connected **Rowan's Google Search Console** to this project. Google returned the verified Domain property for linguascript.co.uk. It covers the apex and www hosts across protocols, and supports reports and sitemap submissions; there is no need to add another property or change DNS for this site.

Google's sitemap record:

- URL: https://linguascript.co.uk/sitemap.xml
- Last submitted: 15 November 2026.
- Last downloaded by Google: 21 November 2026.
- Not pending; **0 errors and 0 warnings**.
- **56 submitted URLs**. The live XML also contains 56 URLs and includes the six language lists and /learn articles.
- Google's deprecated sitemap `indexed` field is not used as indexing evidence.

The existing valid sitemap was preserved and not resubmitted unnecessarily. No verification tag, Google provider setting, domain setting or Lovable publication was needed.

### Measured Google web-search performance

Search Console, **23 October–19 November 2026** (latest 28 complete reporting days):

| Metric | Current period | Previous 28 days |
|---|---:|---:|
| Clicks | 30 | 38 |
| Impressions | 57 | 73 |
| Click-through rate | 52.6% | 52.1% |
| Average position | 1.49 | 2.68 |

These small samples do not establish a meaningful trend or its cause. A high CTR here is not evidence that the site is converting visitors into learners or buyers.

Only the query **“linguascript”** was returned in the query report: 23 clicks, 30 impressions, average position 1. Low-volume queries may be omitted, so the seven other clicks cannot be assigned to non-brand searches. The returned top-page report contains the homepage only; it is not an inventory of indexed pages.

Country report: **Thailand 22 clicks**, **UK 6**, Indonesia 1 and India 1. This is location of search activity, not proof of language, ethnicity, age, buyer intent or demand for Thai lessons. Do not change the product's market on the strength of mostly branded traffic.

### Specific indexing checks

| URL | Google's stored inspection result |
|---|---|
| Homepage | Submitted and indexed; Google selected the apex URL as canonical; last crawl 6 November |
| /words/french | **URL is unknown to Google** |
| /learn/comprehensible-input | **Discovered – currently not indexed**; Google lists the submitted sitemap as a discovery source |

These are Google's indexed records, **not live tests or indexing requests**. They do not establish the state of every language list. The API cannot request indexing: someone with direct access can use URL Inspection in Search Console for the priority pages after improvements are live.

## 2. Live-site audit: what is genuinely present

The Lovable foundations rescan returned eight passing findings and no current failures. Its hosting/pre-rendering verdict must not be assumed to describe Cloudflare Workers. This audit separately fetched the actual live domain.

| Public address | Ordinary live HTML observed | Implication |
|---|---|---|
| /words/french | Specific top-100 title/H1, real word table, self-referencing canonical | Good existing acquisition asset |
| /words/french/top-1000 | Specific title/H1 and full list | Improve this rather than replacing it |
| /words/english | Specific top-100 page and table | Existing asset for the second market |
| /learn/comprehensible-input | Specific article with research discussion and tables | Improve discovery and practical value; Google has discovered it |
| /words/french/top-50 | Homepage fallback HTML, not a top-50 list | **Top 50 is not currently a dedicated page** |
| /words/french/top-100 | Homepage fallback HTML | Top 100 currently lives at /words/french, not this address |
| /vs/language-reactor | Homepage fallback in the initial HTML; React route exists | Comparison content depends on JavaScript; make this page's content directly readable before scaling it |
| /vs/lingopie | Homepage fallback HTML; no matching application route found | **No dedicated Lingopie comparison page** |

A 200 response is not proof that the requested content exists. For the comparison route, fallback HTML does not prove Google cannot render the eventual React page; it does mean the specific comparison is missing from the initial response. Dedicated static pages already work well for /words and /learn, so reuse that mechanism rather than migrating the entire app or hosting stack.

### Other quality risks to address in the content pass

- List rankings are **subtitle word forms**, not dictionary headwords or word families. Keep that explanation next to any coverage claims. Do not equate token coverage with comprehension or fluency.
- Existing list copy promises that the language “opens up months sooner” and uses “fastest start” language without evidence presented for the time/comparison claim. Replace those claims with the measured corpus coverage and a practical study routine.
- The generator uses one Spanish dataset build timestamp across all word pages, and a shared fixed article date. Before regenerating the sitemap, remove non-page-specific date fallbacks; use authoritative per-page dates only. Do not imply a fresh build means fresh editorial review.
- Audit meanings and listen to audio in the first 50/100 before promoting them. Static tables are present; this audit has not checked every translation or voice.
- Keep one canonical top-100 URL. If /top-100 is introduced, redirect it to the existing page rather than creating an identical indexed page.
- Do not index every 50-word learning band as a separate near-duplicate page. Three or four substantial landing lists per language are a better start.

## 3. Search demand and where to focus

**Source: Semrush point-in-time organic estimates, 22 November 2026.** Volumes are estimated monthly searches for the exact keyword and country. Difficulty is Semrush's 0–100 ranking estimate, not paid-ad competition and not a promise of easy rankings. Reported zero difficulty needs cautious interpretation, especially for small keywords.

### UK market

| Exact keyword | Estimated searches/month | Difficulty | Role |
|---|---:|---:|---|
| comprehensible input | 480 | 18 | Broad research guide; useful authority, mixed intent |
| most common english words | 260 | 45 | Second-market frequency asset; more competition |
| most common spanish words | 170 | 33 | Later expansion; dataset/page already exists |
| 1000 most common french words | 110 | 0 | **First priority: improve existing page** |
| most common french words | 90 | 0 | **First priority: improve existing hub/top 100** |
| comprehensible input french | 70 | 0 | Practical French learning intent |
| 100 most common french words | 20 | 0 | Covered by existing /words/french |
| 50 most common french words | 20 | 0 | Small, highly relevant beginner entry point |
| french frequency list | 20 | 0 | Same list intent; no separate duplicate article needed |
| language reactor alternative | 20 | 0 | Small but high-intent comparison |
| lingopie alternative | 0 | 0 | Low/uncertain reported demand; supporting page only |

Do not add the volumes of variants together as unique people. Low volume is not a reason to dismiss a relevant term; nor does a zero estimate mean nobody ever searches it.

### US comparisons (not UK demand)

| Exact keyword | US searches/month | US difficulty |
|---|---:|---:|
| most common french words | 260 | 31 |
| 1000 most common french words | 140 | 28 |
| comprehensible input french | 210 | 10 |
| language reactor alternative | 40 | 0 |
| lingopie alternative | 0 | 0 |

English-language pages can serve UK and US readers without copying them into country-specific duplicates. UK data is the default because this is a UK-domain product; US data shows additional potential, not guaranteed traffic.

## 4. Competitor evidence and a defensible difference

Semrush's competitor-gap sample surfaced large general-language terms, travel phrases, alphabets and slang. Many are poor first targets for LinguaScript: a large number is not evidence that those visitors will start this learning loop.

Its UK Lingopie top-page sample includes a **100 basic French words** article (1.45% reported traffic share in that sample), while several sampled leading pages concern profanity or slang. The tool aggregates a top-keyword sample; this is not a full traffic census. **Take the vocabulary funnel, not an indiscriminate slang-blog strategy.**

Web search supplied competing page examples, not verified Semrush ranking positions:

1. **Learn French With Alexa: top 50 French words** — provides an immediately visible list, meanings and corpus context. LinguaScript can add original short examples, pronunciation and a coherent next learning step. Do not copy its lesson text or list annotations.
2. **Mindomax: top 100 French words** — explains corpus size, grouped forms and cumulative coverage. The lesson is methodological clarity; do not lift its percentages, since its lemmatized counting differs from our form-based data.
3. **Sketch Engine: French word lists** — corpus-based downloadable lists, with explicit lemmatization. Downloads and clear provenance are expected, not unique differentiators.
4. **Bubblegum/WhichLanguageApp alternatives pages** — organise recommendations around the learner's need. Make our comparison useful even when the right answer is another product.
5. **Dreaming French/Alice Ayel and French CI guides** — beginner-graded videos answer practical listening intent. Recommend suitable public resources honestly rather than claiming every authentic film suits an absolute beginner.

### Be careful with comparison claims

Language Reactor's official pages currently describe Netflix/YouTube tools, saved vocabulary, Anki export, AI features and video vocabulary coverage. Its homepage includes phone/tablet messaging alongside desktop-extension messaging. **Do not claim Language Reactor has no mobile product, no reviews, no AI or no coverage scoring.** Verify each feature at publication time and distinguish its website from its desktop extension.

Lingopie's official site describes interactive TV, word lookup and vocabulary practice. Do not claim LinguaScript owns exclusive access to these ideas, or that competing products cannot teach vocabulary.

Our credible angle is a **frequency-first learner path connected to real video and the learner's coloured word deck**. Describe capabilities that are working, including their limits. Android overlays do not imply overlays on iOS, and DRM-protected screen captures remain unavailable. Platform subscriptions remain separate; do not imply licensed Netflix content is included in LinguaScript.

## 5. Recommended acquisition roadmap

### First two weeks: useful lists, discovery, and a working next step

1. Improve /words/french and /words/french/top-1000. Explain forms vs lemmas, keep source/licence credit, remove unsupported speed claims, and verify the first 100 meanings/audio.
2. Add /words/french/top-50 using the existing dataset, **computed coverage**, short original examples and downloadable cards. Link it from /words and the French top-100 page. Keep /words/french as the canonical top-100 page.
3. Add prominent, natural links to the French list and practical method guide from the chosen public homepage and relevant marketing pages. Links to generated static pages must be ordinary links, not React-only navigation.
4. Check that each promoted URL serves its actual content and correct canonical on Cloudflare after deployment. Keep labs, private dashboards and unused landing variants out of the sitemap.
5. Request indexing of the two improved priority list URLs through Search Console's own URL Inspection screen, then check their stored results later. This API cannot request it.
6. Test the list → account → learning-language selection → appropriate flashcards/video journey. A signup alone is not acquisition success. Confirm that French list visitors actually land in French learning, not another active language.

### Weeks three and four: practical French input

Improve the existing /learn/comprehensible-input explanation before creating another general definition. Then create one substantial French beginner resource: graded options, what to choose at A0/A1/A2, a real short viewing routine, when authentic video is too hard, how to replay, and how to combine word learning with listening. Validate candidate videos and subtitle availability; do not invent coverage or learner outcomes.

Link the practical resource to the list, player and existing cited research. Avoid a directory of unverified YouTube embeds. Add updates only when the resources or editorial advice materially change.

### Weeks five and six: comparison intent

Make /vs/language-reactor directly readable, with a dated factual comparison: who each product suits, free/paid boundaries verified from current terms, desktop/mobile distinctions, word review, export, and supported video limitations. Add one honest /vs/lingopie page only after this is sound. Show our affiliation and keep named product badges, not copied logos or implied partnerships.

### Thereafter: expand the winning funnel, not the page count

Apply the validated list → learning journey to English, then Spanish if non-brand impressions and activation justify it. French-native learners of English will need French explanations/meanings rather than merely an English page with runtime UI translation. Research that market separately before creating translated duplicates or hreflang declarations.

School SEO can later use a focused film-vocabulary homework page linked to the real classroom offer, but no school-keyword demand was measured in this audit. Do not divert the first month into dozens of generic teacher articles.

## 6. Measure users, not just rankings

Weekly manual review in Search Console is enough initially; no new paid tracking service is needed.

- Non-brand query impressions and clicks for the priority page group.
- Indexing checks of a few improved URLs, not every URL every day.
- Organic entrance → account created → onboarding completed → first video/word save → first review.
- Return to meaningful learning at seven days; eventual paid upgrade or school enquiry.

Use the existing consent-gated analytics event system. Do not add trackers to static word pages before consent or duplicate PostHog events. Existing `from=words-…` links help identify the next-step source, but without static-page analytics there is **no measured full landing-to-signup conversion rate here**. Search Console does not report purchases or retention.

The first success criterion is **a non-brand page gets indexed and attracts relevant visitors who reach the first learning action**. Set numeric conversion targets only after the funnel is measured; this report does not fabricate baselines or forecast revenue.

## 7. Work completed alongside the audit

- Stremio add-on deployed from the repository with its existing `verify_jwt = false` unchanged. The French/English **manifest.json returned HTTP 200**, add-on version 1.1.0, subtitle resource for movie/series. This verifies the manifest, not actual film subtitle delivery or Stremio installation.
- Phone Google sign-in source now opens Google's own LinguaScript-domain button in the system browser. The return is a one-use magic-link hash bound to the pending attempt; it is delivered to the existing app page, not placed in its URL/history. Legacy backend-address redirects are blocked.
- Callback-rule tests and the single phone Google button/bridge interaction were checked. A real Google account login and native browser-to-app return still require a **new phone build and a real device**. The browser page must first reach Cloudflare through the normal GitHub deployment.
- No Google provider setting, Cloudflare/custom-domain setting, live homepage choice, paid ad, or Lovable site publication was changed.

## Sources and limitations

**Primary evidence:** Rowan's Google Search Console property list, sitemap record, Search Analytics reports, and URL Inspection results, retrieved 22 November 2026; live Cloudflare HTTP responses; repository route/generator inspection; current Lovable foundations review.

**Demand estimates:** Semrush UK and US exact-keyword research, UK competitor-gap sample and UK Lingopie top-page sample on the same date. Semrush SERP lookup for “most common french words” in the UK returned no data, so no numbered SERP positions are asserted. Web-search examples are qualitative comparisons, not substitutes for that missing ranking dataset.

**Pages inspected through web-search results:**

- https://learnfrenchwithalexa.com/blog/the-50-most-common-words-in-french
- https://www.mindomax.com/common-french-words
- https://www.sketchengine.eu/french-word-list/
- https://bubblegum.la/blog/language-reactor-alternatives
- https://whichlanguageapp.com/lingopie-alternatives
- https://comprehensibleinputfrench.com/comprehensible-input-french-app/
- https://app.dreaming.com/french/browse?level=superbeginner
- https://www.languagereactor.com/
- https://www.languagereactor.com/help/basic
- https://www.languagereactor.com/help/whats-new
- https://www.languagereactor.com/pro-mode
- https://lingopie.com/

Web-search text may lag current product changes. Validate claims again before writing a comparison. No competitor content, outcomes or marketing percentages were copied into LinguaScript pages.