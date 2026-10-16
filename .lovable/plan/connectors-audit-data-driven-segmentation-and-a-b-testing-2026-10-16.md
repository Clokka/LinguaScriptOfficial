# Connectors audit: data-driven segmentation and A/B testing

## What connectors can do for LinguaScript

| Area | Connector / tool | What it gives you |
|---|---|---|
| Site traffic | Built-in project analytics | Visitors, pages, referrers, countries, devices |
| Behaviour | Microsoft Clarity (already on) | Heatmaps, session recordings, rage clicks |
| Search | Google Search Console | Search terms, clicks and rankings per page |
| SEO / competitors | Semrush | Keyword gaps vs Duolingo, Lingopie and others |
| Paid ads | Meta Ads, Google Ads | Ad spend, audiences, cost per signup, lookalike audiences |
| Payments | Stripe (test mode now) | Which plan or offer converts, churn, revenue per segment |
| Email | Built-in email | Messages sent to each segment (retention emails already exist) |
| AI | Lovable AI | Labels each segment, writes test versions, summarises results |

What connectors can't do on their own: no connector runs A/B tests or segments people automatically. We build that inside the app, and the connectors supply the data and run the ads.

## Segments (privacy-safe)

- **Location:** country from the browser or ads. No precise location.
- **Demographic:** native language, learning language, level, device. Age only from ad platforms, as groups, never per person.
- **Psychographic (motivation, inferred from behaviour):** "anime fan", "exam student" (A-Level), "traveller", "career", "casual streaker". Taken from their onboarding interests and what they watch.
- **Lifecycle:** visitor → signed up → first word saved → 7-day streak → Pro → at risk of leaving.

## A/B testing plan

1. **Test engine:** each visitor is assigned version A or B, and stays in it across visits. Every view, signup, first saved word and upgrade is recorded with that version.
2. **What we test:**
   - Landing headline and hero for each segment (anime vs exam vs travel)
   - Offers: free chameleon gift vs 7-day Pro trial vs a discounted yearly plan
   - Pricing page layout
3. **AI's job:** writes the test versions for each segment, checks results each day, and declares a winner only once the result is statistically sound (at least 95% confidence and a minimum sample size). Then the winner rolls out.
4. **Admin dashboard:** shows each running test, its conversion rate per segment, the winner and the AI's summary.
5. **Ads loop (optional):** test winners become Meta and Google ad copy, and each ad audience gets the matching landing version.

## Order to build

1. Test engine and event tracking, plus the admin results view
2. Segment labelling (rules first, AI summaries on top)
3. First test: an anime vs exam headline on the landing page
4. Offer tests (need live Stripe to measure real revenue)
5. Connect Meta Ads and Google Ads, then Search Console and Semrush

## Limits

- Real results need traffic: about 1,000 visitors per version per test.
- Live payments are still off, so offer tests can only measure signups or test checkouts until go-live.
- No sensitive traits (health, religion and the like). We'd add a cookie notice for tracking visitors in the UK and EU.

## Technical details

- Tables for experiments, variants, assignments and events (with RLS, admin-read only), with assignment by a hashed visitor id.
- A backend function scores each test (two-proportion z-test) and calls Lovable AI for summaries, run daily on a schedule.
- Ads, Search Console and Semrush are added through the connect flow when you get to that step.
