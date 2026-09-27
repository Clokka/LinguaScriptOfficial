#!/usr/bin/env python3
"""Import UniMorph word forms into public.word_forms.

Only forms that learners actually meet (saved words + top of core_vocabulary)
are imported, so the table stays small. Anything UniMorph lacks (clitic-attached
forms like "ayudarme", slang) is analysed on demand by analyze-word-form.

Usage: words.tsv (language<TAB>surface) + UniMorph files in /tmp/um/<iso3>.tsv
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... python3 scripts/import-unimorph-forms.py
"""
import collections, json, os, sys, urllib.request

LANGS = {"es": "spa", "fr": "fra", "de": "deu", "it": "ita", "pt": "por"}
DIR = os.environ.get("UM_DIR", "/tmp/um")

wanted = collections.defaultdict(set)
for line in open(f"{DIR}/words.tsv", encoding="utf-8"):
    lang, w = line.rstrip("\n").split("\t", 1)
    wanted[lang].add(w)

def classify(feats):
    f = set(feats.split(";"))
    pos = "verb" if "V" in f else "noun" if "N" in f else "adj" if "ADJ" in f else None
    if pos != "verb":
        return pos, None, None, None, None, None
    if "NFIN" in f: form = "infinitive"
    elif "V.CVB" in f: form = "gerund"
    elif "V.PTCP" in f: form = "gerund" if "PRS" in f else "participle"
    else: form = "conjugated"
    person = next((p for p in ("1", "2", "3") if p in f), None) if form == "conjugated" else None
    number = ("sg" if "SG" in f else "pl" if "PL" in f else None) if form == "conjugated" else None
    tense = None
    if form == "conjugated":
        if "FUT" in f: tense = "future"
        elif "COND" in f: tense = "conditional"
        elif "IPFV" in f and "PST" in f: tense = "imperfect"
        elif "PST" in f: tense = "past"
        elif "PRS" in f: tense = "present"
    mood = None
    if form == "conjugated":
        mood = "subjunctive" if "SBJV" in f else "imperative" if "IMP" in f else "indicative"
    return pos, form, person, number, tense, mood

rows = []
for lang, iso in LANGS.items():
    analyses = collections.defaultdict(list)
    for line in open(f"{DIR}/{iso}.tsv", encoding="utf-8"):
        parts = line.rstrip("\n").split("\t")
        if len(parts) < 3: continue
        lemma, surface, feats = parts[0].lower(), parts[1].lower(), parts[2]
        if surface in wanted[lang]:
            pos, *rest = classify(feats)
            if pos: analyses[surface].append((lemma, pos, *rest))
    for surface, an in analyses.items():
        verbs = [a for a in an if a[1] == "verb"]
        # Prefer the verb reading only when the surface is unambiguous as a verb form.
        pick = verbs if verbs and len(verbs) == len(an) else (an if not verbs else None)
        if not pick: continue  # noun/verb homograph — leave to the AI, with context
        lemmas = {a[0] for a in pick}
        forms = {a[2] for a in pick}
        if len(lemmas) != 1 or len(forms) != 1: continue  # ambiguous — AI decides
        def uniq(i):
            vals = {a[i] for a in pick}
            return vals.pop() if len(vals) == 1 else None
        rows.append({"language": lang, "surface": surface, "lemma": pick[0][0], "pos": pick[0][1],
                     "form": pick[0][2], "person": uniq(3), "number": uniq(4), "tense": uniq(5),
                     "mood": uniq(6), "source": "unimorph"})
    print(lang, sum(1 for r in rows if r["language"] == lang), file=sys.stderr)

url = os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/word_forms?on_conflict=language,surface"
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
for i in range(0, len(rows), 1000):
    req = urllib.request.Request(url, data=json.dumps(rows[i:i+1000]).encode(), method="POST", headers={
        "apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"})
    urllib.request.urlopen(req).read()
print("imported", len(rows), file=sys.stderr)
