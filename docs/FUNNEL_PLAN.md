# LinguaScript funnel plan

One sentence: **Tap any word in YouTube or Netflix → it becomes a flashcard.**
The Chrome extension is the product. The website is the "remote control"
(decks, progress, settings) that sends learners out to YouTube/Netflix.

## Who we sell to

| | Uses it | Pays for it | What they care about |
|---|---|---|---|
| Students (13–18, GCSE/A-level, uni) | ✅ | sometimes | fun, no extra homework, grades |
| Parents | — | ✅ | screen time that is actually educational |
| Schools / MFL teachers | — | ✅ (bulk) | results, easy setup, safe, class progress |

Message per buyer:
- **Student:** "Learn French from the YouTube you already watch."
- **Parent:** "Turn Netflix and YouTube into French homework they actually enjoy."
- **School:** "Free for your students. Every word they tap shows up in your class dashboard."

## The journey (HubSpot inbound) — what content goes where

| Stage | What the visitor thinks | Content (where) | Goal of the page |
|---|---|---|---|
| **Awareness** (problem aware) | "Duolingo isn't making me fluent" / "how do I learn French faster" | TOFU: blogs, TikToks, /frequent-words, "learn French with YouTube" guides | Explain the problem + the idea (comprehensible input). Soft CTA: try it free |
| **Consideration** (solution aware) | "Is there a tool that adds subtitles I can click?" | MOFU: how-it-works page, feature pages, comparisons (vs Language Reactor, Lingopie, Duolingo), demo GIFs | Show exactly how it works. CTA: Add to Chrome / start free trial |
| **Decision** | "Is it worth £X? Is it safe for my kid/class?" | BOFU: pricing, free trial, testimonials, school page, FAQ, privacy | Remove doubt. CTA: start trial / book school demo |

So: your instinct is right — top of funnel = teach and build trust (blogs, SEO,
TikTok), middle = explain the product and compare, bottom = pricing, proof, trial.

Paid traffic (Google Ads on "learn French with Netflix") is usually already
**solution aware** → send it straight to a how-it-works + trial page, not a blog.
TikTok traffic is usually **problem aware** → landing page that shows the tap-a-word
moment in the first 3 seconds.

HubSpot's qualifying framework is **GPCT + BA + C&I**: Goals, Plans, Challenges,
Timeline, Budget, Authority, negative Consequences & positive Implications.
Use it on the **school** sales page and demo calls (who has budget/authority =
head of languages), not on student pages.

## Page-to-page flow (the one path we optimise)

```
TikTok / Google Ad / blog
        ↓
Landing (1 screen: headline + 5-second tap demo + "Add to Chrome — free")
        ↓
Sign up (Google one tap)
        ↓
Onboarding (current flow)
        ↓
Extension installed → first YouTube video → first tapped word   ← "aha" moment
        ↓
Flashcards next day (email/push reminder)
        ↓
Free trial ends (7 days) → paywall → £/month
```

Events to watch in PostHog (all exist in src/lib/analytics.ts):
`signed_up → onboarding_completed → extension_install_clicked →
extension_connected → first_word_saved → paywall_viewed → checkout_started →
upgrade_completed`. The biggest drop-off in that chain is the next thing to fix.

## Pricing

- **7-day free trial**, then paywall. Trials that ask for a card convert much
  better (often 40–60% of trials pay) than no-card trials (often 5–15%), but
  far fewer people start them. Start with no card, test card later.
- **£15/month** is above competitors (Language Reactor Pro ≈ $5/mo, Lingopie ≈ $12/mo,
  Duolingo Max ≈ £13/mo). Suggestion: £15/month **or £90/year** (shows as
  "£7.50/month") so the annual plan feels like a deal. Test it, don't guess.
- **Schools:** free for students, the school pays per class/year.

## The maths (example — fill in your real goal)

Example goal: **£1,000/month** in subscriptions at £15 → **67 paying users**.

Typical ranges (industry averages, not our data — replace with PostHog numbers):

| Step | Typical rate | Needed for 67 payers |
|---|---|---|
| Trial → paid (no card) | ~15% | 445 trials |
| Landing visitor → trial | ~10% | 4,450 visitors |
| Google Ads cost per click (UK education) | ~£0.50–£2 | £2,200–£8,900/month |

That means paid ads alone cost **£33–£133 per paying customer**, i.e. 2–9 months
of their subscription. Ads only work if trial→paid and landing→trial go up — which
is why the onboarding and landing must be short and clear. Cheaper channels:
TikTok organic, blogs/SEO, and schools (one teacher = 30 students).

To hit the goal with ads you need roughly: **landing → trial ≥ 10%** and
**trial → paid ≥ 15%**. If either is lower, fix the page before buying more ads.

## Cut list (shrink the app)

Keep (the core loop): extension tap-a-word, flashcards, decks (red/orange/green),
progress, pricing/trial, blog.

Already hidden: /write, /speak, /studio.

Candidates to remove or hide next (they slow the app and confuse new users):
- Extra landing pages: /landing, /landingpage2–5, /landing5, Browse1/Browse2,
  MieoFrames, ChameleonEffectTestPage, GapDemo, Demo — keep ONE landing.
- Leaderboard, friends, XP toasts, 3D model-viewer on first visit.
- Word styles: pick one (Colour or Rings), delete the other.

## Phone vs desktop: "tap a YouTube subtitle, get a pop-up"

- **Desktop Chrome:** yes, with no overlay at all. The extension reads YouTube's
  real subtitles, so any word can be clicked → pop-up. Colours/rings are
  optional decoration on top.
- **Android YouTube app:** Android does not let one app read another app's text.
  The only two ways are Accessibility (Google rejects it for this) or screen
  capture (one "Start now" yes per video) — that's SubtitleTapService. No way
  around that one tap of permission.
- **Netflix app:** not possible (screen is protected, captures are black).
  Netflix in desktop Chrome works with the extension.
