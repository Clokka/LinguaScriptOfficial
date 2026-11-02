# Clickable subtitles inside the YouTube and Netflix phone apps

_Audit, plan and build prompts. November 2026._

> **Update — built (YouTube, first version):** the learner's feedback was "no 🦎 to tap and no pop-up on
> every tap — just tap the subtitle". That is now `mobile/plugins/word-bubble/SubtitleTapService.kt`
> (switch **Tap YouTube subtitles** in Profile). It replaces steps Y1–Y3 below: no bubble, the
> screen-share yes is asked **once** (when a video first plays) and kept alive, the subtitle lines get an
> invisible tap area, and a tap pauses → card → plays. Android has no way to read another app's screen
> with zero questions except the Accessibility permission, which we don't use. Needs an EAS build and a
> real-phone test.

**Goal:** while someone watches in the real **YouTube app** or **Netflix app** on an
Android phone, they can tap a word in the subtitles and get its meaning + Save
(red deck). We want clickable subtitles here, not dual subtitles.

---

## 1. The short answer

| App | How close? | Why |
|---|---|---|
| **YouTube app** | **About 60 %.** It works today as a *snapshot*: tap 🦎 → say yes to the screen-capture pop-up → one frozen picture of the screen → every word on it is tappable. | It is not *live*. You get the consent pop-up on every tap, the video keeps playing, so the subtitle has moved on by the time you tap, and the whole screen is read when we only need the subtitle strip. |
| **Netflix app** | **About 5 %.** We only detect that it fails and show a message. | Netflix marks its screen *secure* (`FLAG_SECURE`). Android gives us a **black** screenshot, so we can't read it with OCR. No setting changes that. We need a completely different route (section 4). |
| iPhone (both apps) | **0 %, and it can't be built.** | iOS doesn't let any app draw over other apps. |

---

## 2. Audit: what exists today

All of this lives in `mobile/plugins/word-bubble/` and is registered by `mobile/plugins/withWordBubble.js`.

| Piece | File | What it does | Good for subtitles? |
|---|---|---|---|
| Floating 🦎 bubble | `BubbleService.kt` | Drag, tap, drop it on ✕ to turn it off, long-press opens the app | ✅ |
| Screen capture | `BubbleService.capture()` | Each tap asks for MediaProjection consent → creates a VirtualDisplay → grabs **one** frame → stops | ⚠️ one frame only, consent every tap |
| Black-screen check | `BubbleService.looksBlack()` | Spots secure apps (Netflix) and shows a toast | ✅ (this is just the "we can't" message) |
| Reading the words | `WordFinder.kt` | ML Kit OCR on the phone; Latin, Japanese, Chinese, Korean and Hindi scripts | ✅ fast enough for a small crop |
| Coloured, tappable words | `WordOverlayView.kt` | Full-screen overlay: Colour or Rings style; you can tap **any** word | ⚠️ full-screen, so it blocks the YouTube controls while open |
| Word card | `ProcessTextActivity.kt` (process-text) | Meaning + Save, with the subtitle line as the example sentence | ✅ |
| Deck colours | `DeckStore.kt` + `files/ls-deck.json` | red/orange/green/gold from the website | ✅ |
| Pausing the video | none | We never pause it | ❌ missing |
| Watching what's playing | none (no `MediaSession` / `NotificationListenerService`) | We don't know the title or the playback position | ❌ missing (needed for Netflix) |
| Desktop Chrome extension | `extension/adapters/youtube.js`, `adapters/netflix.js` | Already does clickable, coloured subtitles on **computers** for both sites | ✅ but desktop only |

**Already checked:**
- The first EAS build was tested on a real phone with the bubble (`docs/APP_FEEDBACK_PLAN.md`).
- Rule from AGENTS.md: **no Accessibility service** (Google rejects it), so we can't read YouTube's caption text from its views. OCR is our way in.

---

## 3. YouTube app: plan to make it feel live

Each step can ship by itself, in this order:

### Step Y1: pause, then read (small, biggest win)
Tap 🦎 → **pause the video first** → capture → show the words → close the overlay → **play again**.
- How: `AudioManager.dispatchMediaKeyEvent(KEYCODE_MEDIA_PAUSE / PLAY)`. It needs **no extra permission** and goes to whatever is playing.
- Result: the subtitle you wanted is still on screen when you tap it.

### Step Y2: read only the subtitle strip
- Crop the picture to the bottom ~35 % of the screen in portrait, or the bottom ~30 % in landscape, before OCR. Add a "read the whole screen" fallback when nothing is found.
- Make the overlay window **only as big as the strip**, so the YouTube controls above it still work.
- Result: faster OCR, fewer junk words (titles, comments, buttons).

### Step Y3: one "yes" per watching session, not per tap
- Keep the MediaProjection + VirtualDisplay **alive** after the first yes. Android 14+ only lets you use a consent token once, but one live projection can give you as many frames as you like.
- Each 🦎 tap just grabs the latest frame (`acquireLatestImage`).
- Stop it when the bubble is dropped on ✕, the tile is switched off, or the screen turns off. Android shows its own "sharing screen" chip while it runs; tell the learner why.
- Result: tap → words in about 0.3 s, with no pop-up.

### Step Y4: Live mode (optional, after Y1–Y3)
- A switch in `PhoneBubbleSetting`: **"Live subtitles"**. While it's on, read the subtitle strip about 2× a second and only redraw when the text changes. Deck words glow in their colours **while the video plays**, and tapping a word pauses the video and opens the card.
- Watch out for: battery, and moving backgrounds behind the words (use Rings if Colour looks messy). Android 12+ blocks touches that pass through mostly-opaque overlays, so the strip must stay small and see-through.

**Estimate:** Y1 + Y2 ≈ 1 session. Y3 ≈ 1 session. Y4 ≈ 2 sessions + phone testing.
After Y1–Y3, YouTube is about **90 %** done.

---

## 4. Netflix app: the honest picture

### What doesn't work
- **Screenshots / OCR:** always black (`FLAG_SECURE`). Not fixable.
- **Accessibility service:** banned by our own rule (Google rejects it), and against Netflix's terms anyway.
- **Netflix in Chrome on the phone:** Netflix sends phone browsers back to the app, and Chrome on Android has no extensions.

### What *can* work: a "companion subtitle strip"
Drawing **over** Netflix is allowed: secure only stops *capture*, not overlays. So we draw **our own** subtitle line in a thin strip and keep it in time with Netflix:

1. **Know what's playing and where we are:** a `NotificationListenerService` (the learner turns it on once in Settings) lets us read `MediaSessionManager.getActiveSessions()`, which gives us the title, the episode, and `PlaybackState.position` (where in the video we are).
   - ⚠️ **First test this on a real phone:** does the Netflix app actually share title + position in its media session? If it doesn't, fall back to "pick your show in LinguaScript, then press ▶ in both".
2. **Get the subtitle text from somewhere other than Netflix:**
   - Our own caption-ready films (we have the rights and the timings), or
   - A subtitle database API. ⚠️ Copyright / terms risk; get advice before you ship this.
3. **Draw the strip:** the same clickable, deck-coloured words as `WordOverlayView`, but from text, not OCR. Tap → pause (same media key as Y1) → word card.
4. **Fix timing drift:** "−0.5 s / +0.5 s" buttons on the strip, because subtitle files and Netflix versions don't always line up.

**Estimate:** a 1-day *spike* first (just check step 1 on a phone). If that works, about 3–4 sessions. If it doesn't, the manual-sync version is weaker, and it's probably better to point Netflix learners to the desktop extension, which already works.

**Recommendation:** finish YouTube Y1–Y3 first. Only start Netflix after the spike says "yes, Netflix shares its position".

---

## 5. Build prompts (copy-paste into Claude Code)

### Prompt A: YouTube Y1 + Y2
> In `mobile/plugins/word-bubble/BubbleService.kt`, when the 🦎 bubble is tapped, pause whatever is playing first with `AudioManager.dispatchMediaKeyEvent` (KEYCODE_MEDIA_PAUSE down+up). Remember that we paused it, and send KEYCODE_MEDIA_PLAY when the overlay closes, but not while the word card is open. Before OCR, crop the captured bitmap to the bottom 35 % of the screen (30 % in landscape), and shift the WordHit rects back into screen pixels. If the crop finds no words, run OCR on the full screen. Make the overlay window only as tall as the area where words were found (plus padding), so the YouTube controls above stay tappable. Keep Colour/Rings, the deck colours and the Netflix black-screen toast as they are. Update the YouTube line in AGENTS.md.

### Prompt B: YouTube Y3 (one consent per session)
> In `BubbleService.kt`, keep the MediaProjection, ImageReader and VirtualDisplay alive after the first consent, instead of stopping after one frame. Later bubble taps grab `acquireLatestImage()` and skip `BubbleStartActivity`'s consent. Release everything on ✕ drop, tile off, `ACTION_STOP`, screen off (register ACTION_SCREEN_OFF), and `MediaProjection.Callback.onStop`. Keep the foreground service type MEDIA_PROJECTION while it's alive and change the notification text to "🦎 Reading subtitles — tap Turn off to stop". Handle Android 14+ rules: the token can only be used once, so if the projection is lost, ask for consent again.

### Prompt C: YouTube Y4 (Live mode)
> Add a "Live subtitles" switch to `PhoneBubbleSetting.tsx`. Send it as a `linguascriptbubble://start?style=…&live=1` link, typed in `packages/core/src/bridge.ts`. When live is on, BubbleService reads the subtitle strip from the kept-alive projection every 500 ms on a background thread, skips OCR when the frame's strip looks the same as last time (a cheap hash), and redraws a strip-sized `WordOverlayView` only when the text changes. Tapping a word pauses the video (media key) and opens the word card. Stop the timer when the screen is off or the bubble is off.

### Prompt D: Netflix spike (do this before building anything)
> Make a debug-only `NotificationListenerService` in `mobile/plugins/word-bubble/` (register it in `withWordBubble.js` with BIND_NOTIFICATION_LISTENER_SERVICE). Add a hidden Profile button that opens the notification-access settings. Every 2 s, log `MediaSessionManager.getActiveSessions(component)`: package name, METADATA_KEY_TITLE, DISPLAY_SUBTITLE, DURATION and `PlaybackState.position` / state. Write the results to `files/ls-media-debug.json` so I can test on a phone with Netflix and YouTube playing. Don't ship it to users yet.

---

## 6. Things only you (the human) can do
- Build with EAS and test on a real Android phone (YouTube with subtitles on).
- For the Netflix spike: play Netflix, and check whether the debug file shows the show's name and a position that keeps going up.
- Get advice before using any outside subtitle database for Netflix shows.
