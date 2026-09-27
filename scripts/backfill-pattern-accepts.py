#!/usr/bin/env python3
"""Declare what each sentence_patterns gap accepts (slots[0].accepts).

The worked example's filler is analysed with analyze-word-form. The frame then
states its requirement explicitly ({pos, form, person?, tense?}), so the checker
no longer guesses from the answer word's shape.
"""
import json, os, urllib.request

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"}

def call(method, path, body=None, extra=None):
    req = urllib.request.Request(URL + path, method=method, headers={**H, **(extra or {})},
                                 data=json.dumps(body).encode() if body is not None else None)
    raw = urllib.request.urlopen(req, timeout=120).read()
    return json.loads(raw) if raw else None

def filler(template, example):
    parts = template.split("___")
    if len(parts) != 2 or not example: return None
    before, after = parts[0].strip(), parts[1].strip()
    norm = lambda s: s.strip().rstrip(".!?")
    rest = norm(example)
    if not rest.lower().startswith(norm(before).lower()): return None
    rest = rest[len(norm(before)):].strip()
    a = norm(after)
    if a:
        if not rest.lower().endswith(a.lower()): return None
        rest = rest[: len(rest) - len(a)].strip()
    toks = rest.split()
    return toks[0].lower() if len(toks) == 1 else None

patterns = call("GET", "/rest/v1/sentence_patterns?select=id,language,template,example,slots")
by_lang = {}
for p in patterns:
    f = filler(p["template"], p["example"])
    if f: by_lang.setdefault(p["language"], []).append((p, f))

done = 0
for lang, items in by_lang.items():
    res = call("POST", "/functions/v1/analyze-word-form", {"language": lang, "words": [f for _, f in items]})
    forms = {r["surface"]: r for r in res.get("forms", [])}
    for p, f in items:
        wf = forms.get(f)
        if not wf: continue
        accepts = {"pos": wf["pos"], "form": wf["form"]}
        if wf["form"] == "conjugated":
            accepts.update({"person": wf["person"], "number": wf["number"], "tense": wf["tense"]})
        slots = p["slots"] or [{}]
        slots[0] = {**slots[0], "accepts": accepts}
        call("PATCH", f"/rest/v1/sentence_patterns?id=eq.{p['id']}", {"slots": slots}, {"Prefer": "return=minimal"})
        done += 1
print("patterns updated:", done, "of", len(patterns))
