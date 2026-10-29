# Instant translations (top ~5,000 words)

These CSVs are loaded into `public.vocab_translations` by the
`20261029120*` / `20261029121*` migrations. The app reads them through
`src/lib/instantGloss.ts`, so tapping a common word shows its meaning
instantly instead of waiting on the AI.

| File | Rows | Word list | Meanings |
|---|---|---|---|
| `vocab_translations_fr_en.csv` | 4,654 | Most frequent words in French film/TV subtitles (names removed) + common contractions like `c'est`, `j'ai` | Written for LinguaScript, in film-speech meaning (`est` = "is", not "east") |
| `vocab_translations_ja_en.csv` | 5,000 | ~180 hand-written particles and everyday words (`は`, `の`, `から`…), then JLPT N5→N1 vocabulary ordered by subtitle frequency | JMdict English glosses, with romaji/kana in `pronunciation` |

Columns: `language, word, native_language, translation, pronunciation, rank, source`.

## Credits / licences
- French and Japanese frequency ranks: [hermitdave/FrequencyWords](https://github.com/hermitdave/FrequencyWords) (OpenSubtitles 2016/2018).
- Japanese meanings and readings: [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks), which uses
  JMdict from the Electronic Dictionary Research and Development Group (CC BY-SA). Keep this credit
  on the site's credits/legal page if these meanings are shown to users.

## Adding a language
Same CSV shape, one row per word. Rank 1 = most common. Keep meanings short
(a phone popup), and give the meaning the word has in everyday speech.
