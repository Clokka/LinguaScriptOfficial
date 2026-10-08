#!/usr/bin/env python3
"""
Export a word -> dictionary form (lemma) table for French, so "manges",
"mangeons" and "mangé" all count as one word: "manger".

Source: spaCy's lookup tables (the `spacy-lookups-data` package, MIT licence).
We only keep the 50,000 most common words from the subtitle frequency list
LinguaScript already uses (hermitdave/FrequencyWords, OpenSubtitles 2018),
which keeps the output small enough to commit.

Usage:
  pip download spacy-lookups-data --no-deps -d /tmp/sld
  curl -o /tmp/fr_full.txt https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_full.txt
  python3 scripts/phrases/export-spacy-lemmas.py /tmp/sld/spacy_lookups_data-*.whl /tmp/fr_full.txt data/fr/fr-lemmas.tsv
"""
import gzip
import json
import sys
import zipfile

TOP_WORDS = 50_000

# The lookup table leaves out, or picks the rarer reading of, some of the most
# common spoken forms. Speech is what LinguaScript teaches, so these win.
OVERRIDES = {
    # être
    "suis": "être", "es": "être", "est": "être", "sommes": "être", "êtes": "être",
    "sont": "être", "étais": "être", "était": "être", "étions": "être",
    "étiez": "être", "étaient": "être", "été": "être", "serai": "être",
    "seras": "être", "sera": "être", "serons": "être", "serez": "être",
    "seront": "être", "serais": "être", "serait": "être", "soit": "être",
    "sois": "être", "soyez": "être", "soyons": "être", "soient": "être",
    # avoir
    "as": "avoir", "eu": "avoir", "eue": "avoir",
    # faire / dire (the table prefers the nouns "fait", "dit")
    "fait": "faire", "faits": "faire", "faite": "faire", "faites": "faire",
    "dit": "dire", "dits": "dire", "dite": "dire", "dites": "dire",
    "dû": "devoir", "due": "devoir",
    # elided and contracted forms
    "j'": "je", "j": "je", "l'": "le", "d'": "de", "qu'": "que", "n'": "ne",
    "m'": "me", "t'": "te", "s'": "se", "c'": "ce",
    "une": "un", "des": "un",
}


def main(wheel: str, freq_path: str, out_path: str) -> None:
    with zipfile.ZipFile(wheel) as z:
        lookup = json.loads(gzip.decompress(z.read("spacy_lookups_data/data/fr_lemma_lookup.json.gz")))

    rows = []
    with open(freq_path, encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i >= TOP_WORDS:
                break
            word = line.split(" ")[0].strip().lower()
            if not word:
                continue
            lemma = OVERRIDES.get(word)
            if lemma is None:
                hit = lookup.get(word)
                lemma = (hit[0] if isinstance(hit, list) else hit) or word
            rows.append((word, lemma))

    with open(out_path, "w", encoding="utf-8") as out:
        out.write("word\tlemma\n")
        for word, lemma in rows:
            out.write(f"{word}\t{lemma}\n")
    print(f"wrote {len(rows)} rows to {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(*sys.argv[1:])
