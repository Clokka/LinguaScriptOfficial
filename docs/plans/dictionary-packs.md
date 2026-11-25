# Dictionary packs — "make taps instant" for every language pair

Status: **plan, not built.** Decisions marked ⚖️ are open for Rowan. Written 25 Nov 2026.

## 1. The goal in one line

A learner taps any word in any video and sees its meaning **in their own language, instantly** — for any native → learning pair (French → Chinese, Japanese → English, …). Taps start online; one button downloads a small dictionary for *their pair only* so taps become instant and work offline.

## 2. What exists today (audited 25 Nov 2026)

| Piece | State |
|---|---|
| Built-in pack | **French → English only**: `public/dict/fr-en.v1.json`, 14,950 words, 298 KB (111 KB gzipped). Same pack in `extension/dict/` and `mobile/plugins/process-text/dict/fr-en.tsv`. |
| When the website downloads it | Only when a French video's subtitles load (`prefetchVideo` → `loadPack`). Nobody else downloads it. |
| Pack format | `{ v, from, to, source, built, words: { word: "one meaning" } }` — one meaning per word, no pinyin/reading. |
| Extension tap path | built-in pack → Google's free `translate_a` endpoint → **nothing** ("Translation unavailable"). Never calls our backend. |
| Website tap path | instant pack → `word_dictionary` → Google → AI (`translate-word`) |
| `translate-word` function | Deployed on the new backend; uses Google (key optional) then Gemini (`GEMINI_API_KEY` is set). Saves results to `word_dictionary`. |
| `word_dictionary` table | **0 rows** on the new backend (old one is locked on Lovable). Columns: language, word, target, translation, lemma, pos, ipa, pronunciation, rank, source. |
| Chinese/Japanese/Thai splitting | `Intl.Segmenter` — e.g. 我又 ("I again") comes out as one word. |
| Why the Chinese tap failed | Google's free endpoint answered fine from our servers (我又 → "I again"); on the learner's computer it most likely rate-limited. No backup = "Translation unavailable". |

**Speed:** one pack ≈ 0.1–0.4 MB gzipped, downloaded once, only for the learner's pair, only when they tap the button → no effect on page speed for anyone else.

## 3. Where meanings come from (licences checked; not legal advice)

| Source | Gives | Licence | Use? |
|---|---|---|---|
| CC-CEDICT | zh → en (+ pinyin) | CC BY-SA 3.0 | ✅ credit + share-alike on the pack |
| CFDICT / HanDeDict | zh → fr / zh → de | CC BY-SA | ✅ (check versions) |
| JMdict (EDRDG) | ja → en (+ some fr/de/ru) | CC BY-SA 3.0, commercial OK, donation asked | ✅ but **not** its frequency numbers |
| Wiktionary (kaikki.org / wiktextract) | most languages; English, French, German… editions | CC BY-SA | ✅ confirm kaikki's terms |
| FrequencyWords (OpenSubtitles 2018) | which words (top 15k) | CC BY-SA 4.0 | ✅ already used |
| Gemini | fills gaps, any pair | output is ours | ✅ with checks (§5) |
| Meta MUSE | 110 pairs | CC BY-NC(-ND) | ❌ non-commercial |
| Reverso, Linguee, etc. | — | proprietary | ❌ |
| Google free endpoint output | — | not ours to redistribute | ❌ for packs (OK for live taps). Note: the current fr-en pack was built this way — rebuild from open sources in phase 3. |

Pack files that include CC BY-SA data are themselves CC BY-SA: credit every source in the file, on /words, in the button's "about" line and in the extension.

## 4. How a learner experiences it (branding)

1. **Online taps (always):** tap → meaning in ~0.5–2 s (Google → our backend → Gemini). Every new meaning is saved, so the next learner gets that word instantly.
2. **The offer** (after ~15 taps in a pair without a pack, never during the first video's first minute):
   > 🦎 **Make taps instant** — Download your French → Chinese dictionary · 0.4 MB · works offline
   > [Download] [Not now]
3. **Download:** progress ring (premium kit `ProgressRing`), then "✓ Instant taps on". Remove/update in Settings → Dictionary.
4. Brand rules: liquid-glass kit (`GlassCard`, `ProgressRing`, `.ls-*`), green chameleon mascot, Inter type. **Red/orange/green/gold/blue are reserved for word states** — the button uses the primary/neutral UI colour, never a deck colour. Copy is short, warm and plain (POSITIONING.md tone). Credits line: "Dictionary: CC-CEDICT (CC BY-SA) + LinguaScript".

## 5. Building a pack (one time per pair, shared by everyone)

1. Words: top 15,000 surface forms of the learning language (FrequencyWords; SUBTLEX-CH for Chinese) — conjugated forms included, so taps match what's on screen.
2. Meanings, best first: open dictionary in the learner's native language → open dictionary in English + Gemini translating the gloss → Gemini alone.
3. Checks before publishing: Gemini output must be in the native language's script; compare a sample of 200 words against Google/`word_dictionary`; disagreements > 10 % → hold for review in HQ.
4. Format v2: `{ v:2, from, to, built, sources:[…], licence, words: { word: { m:["meaning 1","meaning 2"], r:"pinyin/reading", l:"lemma" } } }`. v1 readers keep working for fr-en.
5. Hosting: static files (Cloudflare, `public/dict/` or a public Supabase Storage bucket) + a `dictionary_packs` table (pair, words, bytes, sources, built_at, status).
6. Cost: AI only for gaps, once per pair (roughly a few hundred thousand tokens for a fully AI-made 15k pack) — then $0 per learner. Check current Gemini pricing before bulk builds.

## 6. Order (recommended)

| Phase | What | Why first | Size |
|---|---|---|---|
| 0 | **Extension backup:** `TRANSLATE` falls back to `translate-word` | Ends "Translation unavailable" now; French untouched | ~1 h |
| 1 | Pack format v2 + builder for **English speakers**: zh (CC-CEDICT), ja (JMdict), es (Wiktionary) | Best open data, biggest audience, no AI needed | ~1 day |
| 2 | **"Make taps instant" button** (website word card + Settings, extension pop-up), IndexedDB storage, remove/update | The feature learners see | ~1–2 days |
| 3 | Other native languages: fr→zh (CFDICT), de→zh (HanDeDict), Wiktionary editions; Gemini fills gaps with checks; rebuild fr-en from open data | Any pair, honest licences | ~2 days |
| 4 | On-demand builder for any pair + `dictionary_packs` table + HQ view (status, re-build, hold for review) | Scales to every pair without manual work | ~1–2 days |
| 5 | Dictionary-based word splitting for zh/ja (我又 → 我 + 又) | Better taps in CJK | ~1 day |

## 7. Open decisions ⚖️

1. Name of the feature/button ("Make taps instant" / "Offline dictionary" / "Instant dictionary").
2. When to offer it (after N taps / on the first video / only in Settings).
3. First pairs to build (suggested: en→zh, en→ja, en→es, then fr→zh).
4. Pre-build popular pairs vs build on demand only.
5. Show one meaning or up to three (with pinyin/reading for zh/ja).
