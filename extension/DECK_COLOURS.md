# Deck colours (red / orange / green) — how it works

The colour of every word in the Netflix/YouTube overlay is driven **entirely by
the user's flashcard decks**. A word is the same colour in the extension as it
is on its card in the app. There is exactly one path; nothing else reads or
writes word colours.

## Source of truth
`saved_words.state` in Supabase — the same column the app's flashcard review
writes (`FlashcardReview.tsx`). Three states, mapped to the exact hexes from
`src/pages/Flashcards.tsx` `DECK_CONFIG`:

| state    | deck     | hex       |
|----------|----------|-----------|
| `red`    | UNKNOWN  | `#FF3B30` |
| `orange` | LEARNING | `#FF8A00` |
| `green`  | KNOWN    | `#34C759` |

## The pipeline

```
saved_words.state (DB)
   │
   │  background.js  ── GET_DECK { language } ─────────────────────────────┐
   │    loadDeckIndex(userId, language)                                    │
   │      • language-scoped  ← mirrors Flashcards.tsx (it filters by       │
   │        learningLanguage, so we must too, or counts won't match)       │
   │      • fetchAllSavedWords() pages past PostgREST's 1000-row cap        │
   │      • key = normalizeToken(word)   (lowercase, strip punct, trim)     │
   │      • higherState(): green > orange > red on duplicate keys           │
   │    getDeckIndexCached(): 10s TTL, invalidated on SAVE_WORD / SYNC      │
   │                                                                        ▼
   │  ls-core.js  ── LSCore.Deck ────────────────────────────────  { word: state }
   │    Deck.refresh()  → GET_DECK for the active learning language
   │    Deck._map: normalizeToken(word) → state
   │    Deck.paint(el)  → sets .ls-red / .ls-orange / .ls-green
   │    Deck.stateOf(word), repaintAll(), markSaved(word)
   │    Deck.startAutoRefresh(15s)  → app promotions recolour live
   ▼
 .ls-word spans in the overlay  (CSS hexes = Deck.PALETTE)
```

## Why words used to show red
1. **Un-scoped fetch** — the deck wasn't filtered by language, so it never
   matched the (language-scoped) flashcards page.
2. **1000-row cap** — a heavy deck returned only the first 1000 rows; the rest
   rendered as unseen.
3. **Key mismatch** — background keyed by bare `toLowerCase()` while the overlay
   looked up a punctuation-stripped, trimmed token, so `"Les."` / `"le "` missed
   and fell back to red.
4. **Last-write-wins** — an unordered red duplicate could overwrite a green.

All four are fixed: single `normalizeToken` on both sides, language scoping,
pagination, and `higherState()`.

## Rules for future changes
- **Never** read or set `.ls-red/orange/green` directly — go through `Deck`.
- `normalizeToken` in `ls-core.js`, `background.js` and `src/lib/vocab.ts` must
  stay byte-for-byte identical (they share one keyspace).
- The three hexes live in `Deck.PALETTE`; keep them equal to `DECK_CONFIG`.
- If the app ever stops scoping flashcards by language, drop the `language`
  filter in `GET_DECK` to match.
