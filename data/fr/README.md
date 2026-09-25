# French frequency, word-family and chunk data

Built by `scripts/phrases/`. These are **candidate lists for review**, not
final content: a person marks the `keep` column `yes`/`no`, then
`scripts/seed-core-phrases.ts` loads them into `core_phrases`.

| File | What it is | Rows |
|---|---|---|
| `fr-lemmas.tsv` | word → dictionary form ("manges" → "manger") for the 50,000 most common subtitle words | 50,000 |
| `fr-lemma-frequency.csv` | word families ranked by combined frequency, with their commonest forms | 20,000 |
| `fr-chunks.csv` | 2–5 word phrases with frequency, stickiness (MI) and an `auto_keep` guess | ~9,800 |
| `fr-frames.csv` | phrase-frames with one gap ("je suis ___") for the Sentence Lab | ~490 |

## Columns worth knowing

- **mi**: mutual information, meaning how strongly the words stick together. 3+ is a
  real chunk, 6+ is very tight ("il y a" = 11). Near 0 means the words just
  happen to be common ("et le").
- **auto_keep**: the build's guess. It's `yes` when every word is common in
  real subtitles, the phrase is complete (it doesn't end on "de"/"le"…), it
  isn't bookish, it isn't just an article plus a word ("la vie"), and it's tight
  enough.
- **auto_reason**: why a row was not auto-kept.
- **keep**: **you** fill this in (`yes` / `no`). It overrides `auto_keep`.

## Rebuild

```sh
pip download spacy-lookups-data --no-deps -d /tmp/sld
curl -o /tmp/fr_full.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_full.txt
python3 scripts/phrases/export-spacy-lemmas.py /tmp/sld/spacy_lookups_data-*.whl /tmp/fr_full.txt data/fr/fr-lemmas.tsv
npx tsx scripts/phrases/build-french-data.ts
```

Re-rank chunks by what's said in **LinguaScript's own videos** (the best
source for spoken French):

```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
  npx tsx scripts/phrases/antconc.ts --supabase fr --lemmas data/fr/fr-lemmas.tsv
```

The same tool reads any folder of `.srt` / `.vtt` / `.txt` files
(`--dir PATH`), for example ORFEO or CFPP2000 transcripts once downloaded.

## Sources and credits

- **Word frequencies**: hermitdave/FrequencyWords, from OpenSubtitles 2018.
  Data licence CC BY-SA 3.0, so `fr-lemma-frequency.csv` is shared under CC BY-SA 3.0 too.
  <https://github.com/hermitdave/FrequencyWords>
- **Phrase counts**: Google Books Ngram Corpus v3, cleaned lists by
  orgtre/google-books-ngram-frequency, licensed CC BY 3.0.
  <https://github.com/orgtre/google-books-ngram-frequency>. This is *written*
  French, so bookish rows are flagged; re-rank with `antconc.ts` on subtitles.
- **Word → dictionary form**: spaCy lookup tables (`spacy-lookups-data`), MIT
  licence, plus hand corrections for common spoken forms (see
  `export-spacy-lemmas.py`).
- **Phrase-frames method**: Römer, U. (2010). "Establishing the phraseological
  profile of a text type." *English Text Construction* 3(1).
