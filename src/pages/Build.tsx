// /build — the LinguaScript builder (docs/plans/linguascript-builder.md).
// 1. Pick an unlocked essential phrase (packages/core/src/phrases: unlocked
//    when its key words are in your flashcards; the extension's "🔓 New phrase
//    unlocked" card links here with ?lang=&phrase=).
// 2. Substitution drill: the sentence stays in the box and you swap ONE slot
//    at a time (I will go → I will eat → I will swim).
// 3. Make it yours: one true sentence, only from your flashcard words (tiny
//    grammar words are free; anything else gets "+ Add" to the red deck).
// 4. Gentle AI check (linguascript-write "check"): praise + a tidy version;
//    a correct use counts as a review (promoteUsedWord), like /write.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { phrasesFor, unlockedPhrases, nextPhrases, PHRASE_LEVELS, type EssentialPhrase } from "@linguascript/core/phrases";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard, PremiumHeader, Eyebrow, Skeleton } from "@/components/premium";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { playDing } from "@/lib/sound";
import { track } from "@/lib/analytics";
import { normalizeToken } from "@/lib/vocab";
import { getLanguageLabel } from "@/lib/languages";
import {
  loadPillarDeck, loadMe, checkLinguaScript, promoteUsedWord, saveMyLinguaScript, getMyLinguaScripts,
  tokenize, usesWord, hobby, COLOUR_HEX, type PillarDeck, type Me, type Checked,
} from "@/lib/pillars";

type Step = "pick" | "drill" | "make" | "done";
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
const plain = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim();
const firstForm = (k: string) => k.split("|")[0];
/** Tiny grammar words (de, el, je, y…) never need to be in the flashcards. */
const isFree = (w: string) => normalizeToken(w).length <= 2;

export default function Build() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { learningLanguage } = useLanguage();
  const [params, setParams] = useSearchParams();
  const lang = (params.get("lang") || learningLanguage || "es").toLowerCase();
  const book = phrasesFor(lang);

  const [deck, setDeck] = useState<PillarDeck | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [step, setStep] = useState<Step>("pick");
  const [phrase, setPhrase] = useState<EssentialPhrase | null>(null);

  useEffect(() => {
    if (!user) return;
    loadPillarDeck(user.id, lang).then(setDeck);
    loadMe(user.id).then(setMe);
  }, [user, lang]);

  const words = useMemo(() => (deck ? [...deck.byKey.keys()] : []), [deck]);
  const unlocked = useMemo(() => unlockedPhrases(lang, words), [lang, words]);
  const next = useMemo(() => nextPhrases(lang, words, 3), [lang, words]);

  // ?phrase= from the extension opens that phrase straight away.
  useEffect(() => {
    const id = params.get("phrase");
    if (!id || !deck || phrase) return;
    const p = unlocked.find((x) => x.id === id) || book.find((x) => x.id === id);
    if (p) { setPhrase(p); setStep("drill"); }
  }, [params, deck, unlocked, book, phrase]);

  const open = (p: EssentialPhrase) => { setPhrase(p); setStep("drill"); setParams({ lang, phrase: p.id }, { replace: true }); };
  const back = () => { setPhrase(null); setStep("pick"); setParams({ lang }, { replace: true }); };

  if (!authLoading && !user) {
    return (
      <Shell onBack={() => navigate(-1)}>
        <GlassCard className="p-6 text-center">
          <p className="text-4xl">🦎</p>
          <h2 className="mt-2 text-xl font-bold">Build sentences from your own words</h2>
          <p className="mt-2 text-muted-foreground">Log in so we can see which phrases your flashcards have unlocked.</p>
          <Button className="mt-4" onClick={() => navigate("/auth?next=/build")}>Log in</Button>
        </GlassCard>
      </Shell>
    );
  }
  if (!book.length) {
    return <Shell onBack={() => navigate(-1)}><GlassCard className="p-6">Phrases for {getLanguageLabel(lang)} are coming soon. Spanish and French are ready now.</GlassCard></Shell>;
  }
  if (!deck) {
    return <Shell onBack={() => navigate(-1)}><Skeleton className="h-28 w-full" /><Skeleton className="mt-3 h-64 w-full" /></Shell>;
  }

  return (
    <Shell onBack={step === "pick" ? () => navigate(-1) : back}>
      {step === "pick" && <Pick unlocked={unlocked} next={next} total={book.length} lang={lang} onOpen={open} />}
      {step === "drill" && phrase && <Drill phrase={phrase} onDone={() => setStep("make")} />}
      {step === "make" && phrase && me && user && (
        <Make phrase={phrase} deck={deck} me={me} lang={lang} userId={user.id}
          onDeckChange={() => loadPillarDeck(user.id, lang).then(setDeck)} onDone={() => setStep("done")} />
      )}
      {step === "done" && phrase && <Done lang={lang} onAgain={back} />}
    </Shell>
  );
}

function Shell({ onBack, children }: { onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="ls-aurora min-h-screen bg-background">
      <Seo title="LinguaScript builder" description="Turn your saved words into sentences you'll really use." path="/build" noindex />
      <PremiumHeader title="LinguaScript builder" onBack={onBack} />
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

// ── 1. Pick a phrase ─────────────────────────────────────────────────────────
function Pick({ unlocked, next, total, lang, onOpen }: {
  unlocked: EssentialPhrase[]; next: (EssentialPhrase & { missing: string[] })[]; total: number; lang: string; onOpen: (p: EssentialPhrase) => void;
}) {
  const built = new Set(getMyLinguaScripts(lang).map((s) => s.words.join("|")));
  return (
    <div className="space-y-5">
      <GlassCard glow className="p-5">
        <Eyebrow>Your phrases</Eyebrow>
        <p className="mt-1 text-3xl font-extrabold">{unlocked.length} <span className="text-base font-semibold text-muted-foreground">of {total} unlocked</span></p>
        <p className="mt-1 text-sm text-muted-foreground">Save words while you watch. When your flashcards have every key word of a phrase, it unlocks here.</p>
      </GlassCard>
      {unlocked.length === 0 && <p className="text-muted-foreground">No phrases yet. Save the words below to unlock your first one.</p>}
      {PHRASE_LEVELS.map((level) => {
        const list = unlocked.filter((p) => p.level === level);
        if (!list.length) return null;
        return (
          <section key={level}>
            <Eyebrow>{level}</Eyebrow>
            <div className="mt-2 grid gap-2">
              {list.map((p) => (
                <GlassCard key={p.id} as="button" type="button" onClick={() => onOpen(p)} className="flex items-center gap-3 p-4 text-left transition hover:bg-white/5">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold" translate="no">{p.text}</p>
                    <p className="text-sm text-muted-foreground">{p.en} · {p.fn}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-400">{built.has(p.keys.join("|")) ? "Build again" : "Build ✍️"}</span>
                </GlassCard>
              ))}
            </div>
          </section>
        );
      })}
      {next.length > 0 && (
        <section>
          <Eyebrow>Almost unlocked</Eyebrow>
          <div className="mt-2 grid gap-2">
            {next.map((p) => (
              <GlassCard key={p.id} className="p-4 opacity-80">
                <p className="font-semibold" translate="no">🔒 {p.text}</p>
                <p className="text-sm text-muted-foreground">Save <b translate="no">{p.missing.join(", ")}</b> to unlock · {p.level}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── 2. Substitution drill ──────────────────────────────────────────────────────
function Drill({ phrase, onDone }: { phrase: EssentialPhrase; onDone: () => void }) {
  const slot = phrase.swap ? phrase.parts.find(([, r]) => r === phrase.swap!.role)?.[0] : undefined;
  const rounds = useMemo(() => (phrase.swap && slot ? phrase.swap.options.slice(0, 4).map((o) => phrase.text.replace(slot, o)) : []), [phrase, slot]);
  const [i, setI] = useState(0);
  const [text, setText] = useState(phrase.text);
  const [miss, setMiss] = useState<string | null>(null);
  const [note, setNote] = useState("");

  if (!rounds.length) { // set phrases (idioms) have nothing to swap
    return (
      <PhraseCard phrase={phrase}>
        <p className="mt-4 text-sm text-muted-foreground">This one is a fixed expression: say it exactly like this. Read it aloud twice, then make it yours.</p>
        <Button className="mt-4 w-full" onClick={onDone}>Make it mine →</Button>
      </PhraseCard>
    );
  }
  const target = rounds[i];
  const check = () => {
    if (plain(text) === plain(target) || fold(text) === fold(target)) {
      playDing();
      setNote(plain(text) === plain(target) ? "" : "✓ Right! Watch the accents.");
      setMiss(null);
      if (i + 1 >= rounds.length) onDone(); else setI(i + 1); // the right sentence stays in the box
    } else setMiss(target);
  };
  return (
    <PhraseCard phrase={phrase}>
      <div className="mt-5 flex items-center justify-between text-sm text-muted-foreground">
        <span>🔁 Swap the <b>{phrase.swap!.role}</b></span><span>{i + 1} / {rounds.length}</span>
      </div>
      <p className="mt-2 text-lg">Swap in: <span className="rounded-full border border-white/15 px-3 py-1 font-bold" translate="no">{phrase.swap!.options[i]}</span></p>
      <input value={text} onChange={(e) => { setText(e.target.value); setMiss(null); }} onKeyDown={(e) => e.key === "Enter" && check()}
        translate="no" autoFocus aria-label="Your sentence" className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none focus:border-emerald-500" />
      {miss && <p className="mt-2 text-amber-400">Close! Here's the sentence: <b translate="no">{miss}</b>. Type it once and carry on.</p>}
      {note && !miss && <p className="mt-2 text-emerald-400">{note}</p>}
      <Button className="mt-4 w-full" onClick={check}>Check</Button>
    </PhraseCard>
  );
}

function PhraseCard({ phrase, children }: { phrase: EssentialPhrase; children?: React.ReactNode }) {
  return (
    <GlassCard className="p-5">
      <Eyebrow>{phrase.level} · {phrase.fn}</Eyebrow>
      <div className="mt-3 flex flex-wrap gap-2" translate="no">
        {phrase.parts.map(([t, role], k) => (
          <span key={k} className={`flex flex-col items-center rounded-xl border px-3 py-1.5 ${phrase.swap?.role === role ? "border-dashed border-emerald-500/70" : "border-white/15"}`}>
            <span className="text-lg font-bold">{t}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground" translate="yes">{role}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{phrase.en}</p>
      {children}
    </GlassCard>
  );
}

// ── 3. Make it yours + gentle AI check ─────────────────────────────────────────
function Make({ phrase, deck, me, lang, userId, onDeckChange, onDone }: {
  phrase: EssentialPhrase; deck: PillarDeck; me: Me; lang: string; userId: string; onDeckChange: () => void; onDone: () => void;
}) {
  const interest = me.interests[0] || "travel";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Checked | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const tokens = tokenize(text).filter((t) => t.word);
  const outside = [...new Set(tokens.map((t) => t.text).filter((w) => !isFree(w) && !deck.colours.has(normalizeToken(w))))];
  const usesKey = phrase.keys.some((k) => k.split("|").some((f) => usesWord(text, f)));
  const tiles = useMemo(() => {
    const keyWords = phrase.keys.map(firstForm);
    const mine = [...deck.byKey.values()].sort((a, b) => (a.state === "green" ? -1 : 0) - (b.state === "green" ? -1 : 0)).map((w) => w.word);
    return [...new Set([...keyWords, ...mine])].slice(0, 36);
  }, [phrase, deck]);

  const addWord = async (w: string) => {
    setAdding(w);
    let translation = "";
    try {
      const { translateWord } = await import("@/lib/browserTranslate");
      const t = await Promise.race([translateWord((body) => supabase.functions.invoke("translate-word", { body }), w, text, lang, me.nativeLanguage,
        { from: getLanguageLabel(lang), to: getLanguageLabel(me.nativeLanguage) }), new Promise<null>((r) => setTimeout(() => r(null), 5000))]);
      translation = (t as any)?.translation || "";
    } catch { /* flashcards look the meaning up later */ }
    await supabase.from("saved_words").upsert({ user_id: userId, word: w.toLowerCase(), language: lang, translation, context: text.slice(0, 500), ipa: "", pronunciation: "", state: "red" } as any,
      { onConflict: "user_id,word,language", ignoreDuplicates: true });
    setAdding(null); onDeckChange();
  };

  const check = async () => {
    setBusy(true);
    const keyWords = phrase.keys.map(firstForm).map((word) => ({ word, translation: deck.byKey.get(normalizeToken(word))?.translation || null }));
    const r = await checkLinguaScript({ language: lang, nativeLanguage: me.nativeLanguage, redWords: keyWords, greenWords: [], interest, about: phrase.fn, text });
    setBusy(false);
    if (!r) return;
    setResult(r);
    track("write_checked", { source: "build", phrase: phrase.id, score: r.score });
    if (r.score >= 30) {
      playDing();
      for (const k of phrase.keys) {
        const form = k.split("|").find((f) => usesWord(text, f));
        const row = form && deck.byKey.get(normalizeToken(form));
        if (row) await promoteUsedWord(userId, row); // using it right = a correct review
      }
    }
    saveMyLinguaScript(lang, { text: r.corrected || text, translation: r.translation, words: phrase.keys, interest, score: r.score, at: new Date().toISOString() });
  };

  return (
    <div className="space-y-4">
      <PhraseCard phrase={phrase} />
      <GlassCard className="p-5">
        <Eyebrow>Your turn · only your words</Eyebrow>
        <h2 className="mt-1 text-xl font-bold">Say something true about {hobby(interest).emoji} {hobby(interest).label.toLowerCase()} with this phrase</h2>
        <div className="mt-3 flex flex-wrap gap-1.5" translate="no">
          {tiles.map((w) => {
            const c = deck.colours.get(normalizeToken(w));
            return <button key={w} type="button" onClick={() => setText((t) => (t ? `${t.trimEnd()} ${w}` : w))}
              className="rounded-full border px-3 py-1 text-sm font-semibold" style={{ borderColor: c ? COLOUR_HEX[c] : "rgba(255,255,255,.2)", color: c ? COLOUR_HEX[c] : undefined }}>{w}</button>;
          })}
        </div>
        <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={2} translate="no" aria-label="Your LinguaScript"
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-lg outline-none focus:border-emerald-500" placeholder={phrase.text} />
        {outside.length > 0 && (
          <p className="mt-2 text-sm text-amber-400">Not in your flashcards yet:{" "}
            {outside.map((w) => <button key={w} type="button" disabled={adding === w} onClick={() => addWord(w)} className="ml-1 rounded-full border border-amber-400/60 px-2 py-0.5 font-semibold" translate="no">{adding === w ? "adding…" : `+ ${w}`}</button>)}
          </p>
        )}
        {text && !usesKey && <p className="mt-2 text-sm text-muted-foreground">Use one of the phrase's key words: <b translate="no">{phrase.keys.map(firstForm).join(", ")}</b></p>}
        {!result && <Button className="mt-4 w-full" disabled={busy || !text.trim() || outside.length > 0 || !usesKey} onClick={check}>{busy ? "Checking…" : "Make it mine 🦎"}</Button>}
        {result && (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className={result.score >= 30 ? "font-semibold text-emerald-400" : "font-semibold text-amber-400"}>{result.score >= 30 ? "Lovely! 🎉" : "Saved. We tidied it a little:"} {result.feedback}</p>
            {plain(result.corrected) !== plain(text) && <p className="mt-2 text-lg font-bold" translate="no">{result.corrected}</p>}
            {result.translation && <p className="text-sm text-muted-foreground">{result.translation}</p>}
            <Button className="mt-3 w-full" onClick={onDone}>Done →</Button>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ── 4. Wrap-up ────────────────────────────────────────────────────────────────
function Done({ lang, onAgain }: { lang: string; onAgain: () => void }) {
  const mine = getMyLinguaScripts(lang);
  const last = mine[0];
  return (
    <GlassCard glow className="p-6 text-center">
      <p className="text-5xl">🦎</p>
      <Eyebrow className="mt-3">Your LinguaScript #{mine.length}</Eyebrow>
      {last && <p className="mt-2 text-2xl font-extrabold" translate="no">“{last.text}”</p>}
      {last?.translation && <p className="mt-1 text-muted-foreground">{last.translation}</p>}
      <p className="mt-3 text-sm text-muted-foreground">{last && last.score >= 30 ? "You used your words correctly, so they moved up a colour." : "Keep going: words move up a colour when you use them correctly."}</p>
      <Button className="mt-5 w-full" onClick={onAgain}>Build another</Button>
    </GlassCard>
  );
}
