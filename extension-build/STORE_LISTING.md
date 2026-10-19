# Chrome Web Store listing — LinguaScript 1.2.0

Everything to paste into the Chrome Web Store Developer Dashboard
(https://chrome.google.com/webstore/devconsole). Build the upload zip with
`scripts/pack-extension.sh` → `extension-build/linguascript-extension-1.2.0.zip`.

## Store listing tab

**Name** (from the manifest): LinguaScript: Learn Languages with YouTube & Netflix

**Summary** (from the manifest, max 132 characters):
Learn a language from YouTube and Netflix. Dual subtitles, tap any word for its meaning, and save it to your LinguaScript flashcards.

**Description:**

> Turn any YouTube video or Netflix show into a language lesson.
>
> LinguaScript shows the subtitles in the language you're learning with your own language underneath. Tap any word to see what it means, with examples, and save it to your flashcards with one tap.
>
> ● Dual subtitles on YouTube and Netflix: the language you're learning plus your own
> ● Tap any word for its meaning, synonyms and examples
> ● Words are coloured by your flashcard decks: red = new, orange = learning, green = known
> ● Save words straight to your LinguaScript flashcards and review them on linguascript.co.uk
> ● Today's word goal and your 🔥 streak in the toolbar pop-up
> ● Transcript panel, replay a line, slow down to 0.5×, auto-pause after each line
> ● Works with Chinese, Japanese and Thai too (words are split even without spaces)
>
> Keyboard shortcuts: A = previous line, S = replay line, D = next line, Q = auto-pause.
>
> You need a free LinguaScript account to save words: https://linguascript.co.uk

**Category:** Education
**Language:** English

**Graphic assets** (in `extension-build/store-assets/`):
| Asset | File | Size |
|---|---|---|
| Store icon | `extension/icons/icon128.png` | 128×128 |
| Screenshot 1 | `screenshot-1-tap-any-word.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-chinese.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-goal-and-streak.png` | 1280×800 |
| Screenshot 4 | `screenshot-4-welcome.png` | 1280×800 |
| Small promo tile | `promo-tile-440x280.png` | 440×280 |

Tip: once it's installed, a real screenshot on a real YouTube video is even better. Swap one in.

**Official URL / Homepage:** https://linguascript.co.uk
**Support URL:** https://linguascript.co.uk (or mailto:rowan@linguascript.co.uk)

## Privacy practices tab

**Single purpose:**
Helps people learn a language while watching YouTube and Netflix: it shows dual-language subtitles, translates words the user taps, and saves chosen words to the user's LinguaScript flashcards.

**Permission justifications:**
| Permission | Why |
|---|---|
| `storage` | Keeps the user signed in (session token) and remembers their learning and native language on this device. |
| Host `https://www.youtube.com/*` | Shows the subtitle overlay, word colours and word card on YouTube watch pages, and reads the video's caption track. |
| Host `https://www.netflix.com/*` | Shows the subtitle overlay, word colours and word card on Netflix watch pages, reading the subtitle text Netflix displays. |
| Host `https://translate.googleapis.com/*` | Translates a tapped word or a subtitle line into the user's language. |
| Host `https://ffephracinqeylfhqkiz.supabase.co/*` | The LinguaScript backend: sign-in, reading the learner's language, goal, streak and flashcard decks, and saving words they choose. |

**Remote code:** No, I am not using remote code. (All JavaScript is in the package.)

**Data usage — tick these:**
- Personally identifiable information (email address, for sign-in)
- Authentication information (password sent once to sign in; session token stored)
- Website content (subtitle text of the word/line the user taps, sent for translation and saved with the word)

Leave everything else unticked (no health, financial, location, web history, user activity, personal communications).

**Certify all three:** not sold to third parties; not used for unrelated purposes; not used for creditworthiness or lending.

**Privacy policy URL:** https://linguascript.co.uk/privacy-extension

## Distribution tab
- Visibility: Public
- Regions: All regions
- Pricing: Free

## What's not in 1.2.0 (coming in updates)
- Orange "learn next" rings and auto-pause on ring words, pre-teach warm-up, gold words, XP
