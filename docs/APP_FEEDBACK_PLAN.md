# Phone app feedback (1 Nov 2026): audit, plan, prompt

From testing the first EAS build with the tile, widget, lock-screen card and bubble.

## Audit

| # | What you saw | Why it happens | Fix |
|---|---|---|---|
| 1 | The app opens on the website's landing page (3D chameleon, confetti, App Store / Google Play buttons) | `src/pages/Index.tsx` shows `LandingPageTest` to anyone signed out — it doesn't know it's inside the app | App-only welcome screens when `window.ReactNativeWebView` is set (plan below) |
| 2 | The 🦎 bubble can't be got rid of | `BubbleService` only supports drag + tap; turning it off needs the Profile switch | Drag it to the bottom → an ✕ target appears → drop = bubble off |
| 3 | Want "LinguaScript" in the swipe-down panel to switch the overlay on | The tile exists but only *reads the screen once*; it isn't an on/off switch and doesn't show on/off | Tile = toggle: lit when the bubble is on, tap = on/off |
| 4 | Highlight a word → no "Save to LinguaScript" (menu shows Share, Web search, Ask Claude, **Manage apps**) | Samsung only shows the extra apps you tick in **Manage apps**; LinguaScript is off by default there. Also, inside the LinguaScript app itself the menu is the WebView's | (a) Tell users: tap **Manage apps** → switch on LinguaScript. (b) In the app/site: our own "Save" chip when you select text on any LinguaScript page |
| 5 | Widget tap → **"Unmatched Route — linguascript:///open/flashcards"** | The phone app uses expo-router; it sees the link before `app/index.tsx` does and has no `open/…` page | Add `mobile/app/open/[...path].tsx` that hands the path to the WebView |
| 6 | Widget: tapping the red square should open the red deck (orange → orange, green → green) | The whole widget has one tap target; `/flashcards` has no `?deck=` | Each square gets its own link: `open/flashcards?deck=red` …; Flashcards reads `?deck=` |
| 7 | Connect YouTube → **Google "Access blocked … has not completed the Google verification process", Error 403 access_denied** | The button asks Google for `youtube.force-ssl` (full control of the YouTube account). That is a *sensitive* scope: while the Google app is in "Testing", only listed test users can grant it; to open it to everyone, Google must verify the app. And `/privacy` says we ask for **no** Google scopes beyond sign-in, which verification would reject | Now: hide the button (or show "coming soon"). You: add yourself as a test user to try it. Later: fix the privacy text, ask for a smaller scope, verify (see below) |

## Plan (in order)

1. **Widget + links (bug):** `mobile/app/open/[...path].tsx` → WebView opens `https://linguascript.co.uk/<path>?<query>`. Each widget square its own `PendingIntent`: `flashcards?deck=red|orange|green`; gold strip → `flashcards?deck=gold` (due reviews). `Flashcards.tsx` reads `?deck=`.
2. **Bubble ✕:** while dragging, show a round ✕ at the bottom centre; drop on it → stop the service, save "off" (Profile switch follows next time the app opens).
3. **Tile = on/off switch:** `STATE_ACTIVE` when `BubbleService` is running; tap toggles; subtitle "On" / "Off". Asking for "display over other apps" still opens from the tile the first time.
4. **Highlight-to-save:** (a) first-run tip card in the app + /overlay page: "Samsung: tap Manage apps → LinguaScript on". (b) On LinguaScript pages, selecting text shows a small "Save to LinguaScript" chip (works on web too).
5. **YouTube connect:** hide the button until Google verification is done; keep the code. Then: update `/privacy` (name the YouTube scope and why), switch to the smallest scope the feature needs, set up an auth custom domain (so Google shows "linguascript.co.uk", not "…supabase.co"), submit for verification with a demo video.
6. **App welcome screens** (below).

## App welcome screens — ideas

Feels like an app, not a website: full screen, no web header/footer, no cookie wall in the way, no "Download on the App Store" (they already have it), big thumb buttons at the bottom, swipe between cards, fast (SVG chameleon, no 3D or confetti on first open).

1. **Welcome** — the chameleon (SVG) slowly changes colour red → orange → green. "Learn a language from what you already watch." Big **Get started** · small "I already have an account".
2. **Swipe card 1 — Watch:** a subtitle line where words turn red/orange/green as you watch. "Every word shows how well you know it."
3. **Swipe card 2 — Tap any word, anywhere:** the 🦎 bubble over a YouTube frame, a word tapped, its meaning + Save. "YouTube, Chrome, WhatsApp — one tap saves it."
4. **Swipe card 3 — 2 minutes a day:** a gold word on a lock screen. "Gold words are ones you already know. Keep them gold-fresh."
5. **Pick your language** (big flag grid) → **pick a hobby** → **goal** (the existing onboarding).
6. **Try first, sign up after:** save 3 words as a guest (guest words already exist), *then* "Save your words — continue with Google / email".
7. **Turn on the phone extras** (one screen, all optional): overlay bubble, widget, gold lock-screen word, Samsung "Manage apps" tip.

## Prompt (paste to Claude Code / Lovable)

> In the LinguaScript repo (read AGENTS.md and docs/APP_FEEDBACK_PLAN.md first), fix the phone app feedback in this order, one commit each:
> 1. Widget taps show "Unmatched Route" for `linguascript:///open/flashcards`. Add `mobile/app/open/[...path].tsx` that opens `https://linguascript.co.uk/<path>?<query>` in the existing WebView. Make each widget square open its own deck (`flashcards?deck=red|orange|green`, gold strip → `?deck=gold`) with separate PendingIntents in `DeckWidget.kt`, and make `src/pages/Flashcards.tsx` open the deck from `?deck=`.
> 2. Let the 🦎 bubble be dismissed: while dragging, show an ✕ target at the bottom centre; dropping on it stops `BubbleService` and saves it as off.
> 3. Make the quick-settings tile an on/off switch for the bubble (`STATE_ACTIVE` while `BubbleService` runs, subtitle On/Off).
> 4. Add a "Save to LinguaScript" chip when text is selected on any LinguaScript page (saves to the red deck like the Chrome extension), and a tip "Samsung: tap Manage apps → switch on LinguaScript" on /overlay and in the phone settings card.
> 5. Hide "Connect YouTube" in Profile behind a flag until Google verification is done; fix /privacy so it names any YouTube scope we request.
> 6. Build app-only welcome screens when `window.ReactNativeWebView` is set and nobody is signed in: welcome → 3 swipe cards (watch / tap any word / gold reviews) → language → hobby → goal → try 3 words as a guest → sign up → optional phone extras. Full screen, bottom thumb buttons, SVG chameleon (no three.js), no app-store badges, keep the first-load bundle small.
> Keep the review ladder in packages/core/src/review.ts, analytics through src/lib/analytics.ts, and run `npx vite build` + `npx expo prebuild` checks before pushing.

## You (outside the code)

- **YouTube now, for testing:** Google Cloud Console → APIs & Services → OAuth consent screen → **Audience → Test users → Add** your Google email. The button then works for you only.
- **YouTube for everyone:** needs Google verification (privacy policy, demo video, domain). Do this after plan step 5.
- **Samsung highlight menu:** select text → **Manage apps** → switch **LinguaScript** on.
