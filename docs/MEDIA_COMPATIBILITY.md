# LinguaScript on every video player

Goal: dual subtitles, deck colours and tap-to-save on **any** video. That
includes YouTube, Netflix, Crunchyroll, Stremio, TikTok, Dailymotion, and any
site where we can find the captions. Then the same for the **desktop apps**
(Netflix, Crunchyroll, Stremio). Mobile comes after that.

## 1. Browser: how it works (built)

| Piece | File | Job |
|---|---|---|
| Site list | `extension/sites.js` | One entry per site: origins (page + player iframe), subtitle selectors, control-bar selectors, min video length, `videoId()` for feeds. |
| Caption catcher | `extension/caption-hook.js` | Runs in the page's own JS world at `document_start`, in every frame. Watches `fetch` and `XMLHttpRequest` and posts a **copy** of any response that looks like subtitles. Also follows subtitle URLs listed in JSON (TikTok `subtitleInfos`). It keeps the last 8 files and re-sends them when the adapter says hello, because players fetch before `document_idle`. It never changes or delays a response. |
| Subtitle reader | `extension/subtitles.js` | WebVTT, SRT, ASS/SSA, TTML/DFXP, Bilibili BCC JSON, YouTube json3 → `[{start,end,text}]`, plus `textAt(cues, t)` and URL language hints. Tested by `npm run test:subs`. |
| Universal adapter | `extension/adapters/universal.js` | Every site except YouTube/Netflix (they keep their own adapters). Source ladder: **learner's file (📄) → caught file → `<video>` text tracks → on-page subtitle text** (including open shadow roots). Timed sources are polled 4×/s through `LiveCaptions.poke()`. `[` / `]` shift a file ±0.5 s. |
| Any-site switch | `background.js` (`syncVideoSites`, `enableVideoTab`) + pop-up "This page" card | Sites outside `manifest.json` are switched on at the learner's click. That asks for an **optional** host permission for just that site, so there's no install warning. Then the catcher + adapter are registered with `chrome.scripting.registerContentScripts`, so the site keeps working after a restart. A blanket "all sites" grant is ignored on purpose. |

Built in (no click): YouTube, Netflix, Crunchyroll, TV5MONDE.
One click: everything in `sites.js` (Stremio Web, TikTok, Dailymotion, Vimeo, Prime Video, Disney+, Max, Viki, Bilibili, Plex, ARTE, france.tv, RTVE, ARD/ZDF, RaiPlay, TED, Udemy, Coursera) and **any other site** with a `<video>`, including self-hosted Jellyfin/Plex.

Why the catcher matters: **Crunchyroll paints anime subtitles on a canvas**, so before this there was no text to read. Now the `.ass` file it downloads is read instead. This was checked in Chromium with the real extension: canvas subtitles became tappable words and followed the video clock.

### Add a site
1. Add an entry to `SITES` in `extension/sites.js` (origins for the page and its player iframe).
2. If subtitles are drawn as HTML, add their selector to `subtitleSelectors`.
3. `npm run test:subs`. No manifest change is needed: the pop-up asks for the origins.
4. Only move a site into `manifest.json` `content_scripts` with a version bump. New static hosts make Chrome **disable the extension until the user re-approves**. Keep that for the biggest sites only.

### Honest limits
- No subtitles anywhere (not in a file, track or the page) → nothing to show. The learner can press 📄 and load a `.srt`/`.vtt`.
- TikTok: only videos with captions (CC); network captions only match on a `/video/<id>` page.
- A site that sends subtitles inside encrypted video segments (rare) can't be read. That's the same reason Netflix-style DRM blocks screen reading.
- The catcher only sees files fetched after it loads. Right after "Turn on here", re-pick subtitles in the player (or reload).

## 2. Desktop apps

The browser extension can't enter native or Store apps: Netflix (Microsoft Store), Crunchyroll (Microsoft Store), Stremio (Qt/mpv, newer builds WebView2/mpv). Three routes, cheapest first:

### Route A: "the site as an app" (works today, no new code)
Chrome/Edge can install netflix.com, crunchyroll.com and web.stremio.com as apps. They get their own window and taskbar/Dock icon. Chrome extensions keep running inside these app windows, so LinguaScript works there exactly as in a tab. Tell learners:
*Chrome → ⋮ → Cast, save and share → Install page as app* (wording varies by version).
This is the recommended "Netflix / Crunchyroll desktop app" answer for now.

### Route B: Stremio add-on (built): Stremio desktop, Android, TV
`supabase/functions/stremio-addon` speaks Stremio's official add-on protocol. It offers subtitles named **"LinguaScript French + English"**: the learning-language line, with the learner's own language underneath in grey italics. Install page: **linguascript.co.uk/stremio** (`src/pages/ConnectStremio.tsx`, direct URL for now).
- **No API keys.** It uses the same pieces as the rest of LinguaScript:
  - Source files come from Stremio's own public **OpenSubtitles v3** add-on (the entry learners already see in Stremio). Only `*.strem.io` file links are ever fetched, so the function is never an open proxy.
  - The parsed lines go in the shared `public.caption_cache` table (`video_id = "stremio:<hash>"`, the same table fetch-captions uses), checked with `subtitlesLookLikeWrongLanguage`.
  - The second line comes from `googleTranslateMany`, which uses the official API when `GOOGLE_TRANSLATE_API_KEY` is set.
  - The finished dual `.srt` is cached in the private `stremio-subs` bucket (`docs/sql/stremio-addon.sql`), so each episode is translated once.
- `supabase/config.toml` has `verify_jwt = false` for this function, because Stremio can't send a login.
- **Phase 2: deck colours.** Add a personal add-on key (`/<key>/manifest.json`, a table mapping key → user, revocable on /stremio). Serve **ASS** with red/orange/green word colours. Stremio desktop plays through mpv, which renders ASS colours; check the web and TV players before relying on it. Tap-to-save stays a browser/phone feature, because Stremio has no click API for subtitles.

### Route C: LinguaScript Desktop companion (next big build)
A small always-on-top overlay app (Tauri: tiny, Windows + macOS). It works over **any** desktop app, including the Netflix and Crunchyroll Store apps:
- **Text source = system live captions, not screenshots.** DRM video (Netflix, Crunchyroll) usually shows **black in screen captures**, so OCR (the Android bubble's method) fails there. Captions made from the *audio* keep working.
  - Windows 11 **Live Captions** (Win+Ctrl+L): read its caption text through UI Automation. It supports several languages beyond English on recent Windows 11 builds; check the learner's language list in a prototype.
  - macOS **Live Captions**: read through the Accessibility API. Language support is narrower; check it per macOS version.
  - Fallback: our own `transcribe-audio` on system-audio loopback (WASAPI loopback on Windows, ScreenCaptureKit audio on macOS). This costs AI credits, so it's opt-in.
- The overlay shows the line in deck colours. A tap opens the same word card (sign-in shared with the site via the `extension-handoff` flow) and saves to the red deck. Pause/play uses system media keys, like Android's SubtitleTapService.
- Prototype order: Windows Live Captions → overlay → word card → save. Ship to Windows first (Netflix and Crunchyroll Store apps are Windows-only).

## 3. Mobile (later)
- Android already has the 🦎 bubble, SubtitleTapService and "Add to LinguaScript". The Stremio add-on works in Stremio for Android today.
- iOS: no overlay or screen reading is allowed. The options are the Stremio add-on, Share → LinguaScript, and Safari Web Extension (the same adapter files can be packaged for Safari on iOS, but the browser only, not apps).
