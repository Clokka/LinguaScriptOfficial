import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Volume2, Lightbulb, ArrowRight, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useXp } from "@/contexts/XpContext";
import { PillarsNav, WordChip } from "@/components/PillarsNav";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Seo } from "@/components/Seo";
import { playDing } from "@/lib/sound";
import {
  ABOUT_QUESTION,
  COLOUR_HEX,
  checkLinguaScript,
  colourOf,
  composeLinguaScript,
  getAbout,
  getMyLinguaScripts,
  hobby,
  loadMe,
  loadPillarDeck,
  pickRedPair,
  promoteUsedWord,
  saveMyLinguaScript,
  setAbout,
  tokenize,
  usesWord,
  type Checked,
  type Composed,
  type Me,
  type PillarDeck,
  type PillarWord,
} from "@/lib/pillars";

/**
 * ✍️ Pillar 2 — WRITING (autographia).
 * 1–2 red words + the green words you know + your hobby → write a LinguaScript.
 */
export default function Write() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { learningLanguage, speak } = useLanguage();
  const { award } = useXp();
  const lang = learningLanguage || "fr";

  const [me, setMe] = useState<Me | null>(null);
  const [deck, setDeck] = useState<PillarDeck | null>(null);
  const [interest, setInterest] = useState("travel");
  const [about, setAboutState] = useState("");
  const [round, setRound] = useState(0);
  const [pair, setPair] = useState<PillarWord[]>([]);
  const [composed, setComposed] = useState<Composed | null>(null);
  const [composing, setComposing] = useState(false);
  const [hint, setHint] = useState(false);
  const [text, setText] = useState("");
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Checked | null>(null);
  const [promoted, setPromoted] = useState<Record<string, string>>({});
  const [mine, setMine] = useState(() => getMyLinguaScripts(lang));
  const [error, setError] = useState<string | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    loadMe(user.id).then((m) => {
      setMe(m);
      setInterest(m.interests[0]);
      setAboutState(getAbout(m.interests[0]));
    });
    loadPillarDeck(user.id, lang).then(setDeck);
    setMine(getMyLinguaScripts(lang));
  }, [user, lang]);

  // New pair of red words → ask the AI for the prompt + a model LinguaScript.
  const compose = useCallback(async () => {
    if (!deck || !me) return;
    const p = pickRedPair(deck.red, round);
    setPair(p);
    setComposed(null);
    setResult(null);
    setHint(false);
    setText("");
    setPromoted({});
    setError(null);
    if (p.length === 0) return;
    const my = ++reqId.current;
    setComposing(true);
    const c = await composeLinguaScript({
      language: lang,
      nativeLanguage: me.nativeLanguage,
      redWords: p.map((w) => ({ word: w.word, translation: w.translation })),
      greenWords: deck.greenSample,
      interest: hobby(interest).label,
      about,
    }).catch(() => null);
    if (my !== reqId.current) return;
    setComposed(c);
    setComposing(false);
  }, [deck, me, round, lang, interest, about]);

  // Re-compose when the words, round or hobby change (not on every keystroke of "about").
  const aboutRef = useRef(about);
  aboutRef.current = about;
  useEffect(() => {
    compose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, me, round, interest]);

  const greenHints = useMemo(() => (deck ? deck.greenSample.slice(0, 8) : []), [deck]);
  const usedRed = pair.filter((w) => usesWord(text, w.word));
  const allUsed = pair.length > 0 && usedRed.length === pair.length;
  const tier: ChameleonTier = result ? (result.score >= 30 ? "green" : result.score >= 15 ? "orange" : "red") : allUsed ? "orange" : "red";

  const check = async () => {
    if (!me || !text.trim()) return;
    setChecking(true);
    setError(null);
    const r = await checkLinguaScript({
      language: lang,
      nativeLanguage: me.nativeLanguage,
      redWords: pair.map((w) => ({ word: w.word, translation: w.translation })),
      greenWords: [],
      interest: hobby(interest).label,
      about,
      text,
    }).catch(() => null);
    setChecking(false);
    if (!r) { setError("⚠️"); return; }
    setResult(r);
    if (r.score >= 30 && user) {
      playDing();
      award("review_card", { correct: true });
      // Using a red word correctly IS a review: it moves red → orange.
      const used = pair.filter((w) => usesWord(r.corrected || text, w.word) || r.usedWords.some((u) => u.toLowerCase() === w.word.toLowerCase()));
      const next: Record<string, string> = {};
      for (const w of used) next[w.word] = await promoteUsedWord(user.id, w);
      setPromoted(next);
      const saved = { text: r.corrected || text, translation: r.translation, words: pair.map((w) => w.word), interest, score: r.score, at: new Date().toISOString() };
      saveMyLinguaScript(lang, saved);
      setMine(getMyLinguaScripts(lang));
    }
  };

  const nextRound = () => {
    if (deck && Object.keys(promoted).length) {
      // Promoted words leave the red pile for this session.
      setDeck({ ...deck, red: deck.red.filter((w) => !promoted[w.word]) });
    }
    setRound((r) => r + 1);
  };

  if (!user || !deck || !me) {
    return (
      <div className="min-h-screen bg-background">
        <PillarsNav />
        <div className="grid place-items-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  const aboutQ = ABOUT_QUESTION[interest];

  return (
    <div className="min-h-screen bg-background pb-24">
      <Seo title="Write · LinguaScript" description="Write LinguaScripts with your new words." path="/write" />
      <PillarsNav />
      <main className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        {/* Chameleon + pillar symbol */}
        <div className="flex items-center gap-4">
          <ChameleonMascot tier={tier} party={!!result && result.score >= 30} className="w-20 h-20 shrink-0" />
          <div className="text-4xl" aria-hidden>✍️</div>
          <div className="flex-1" />
          <div className="flex gap-1.5 flex-wrap justify-end">
            {me.interests.map((id) => {
              const h = hobby(id);
              return (
                <button
                  key={id}
                  onClick={() => { setInterest(id); setAboutState(getAbout(id)); }}
                  title={h.label}
                  className={`w-11 h-11 rounded-2xl text-xl grid place-items-center border transition-all ${id === interest ? "border-primary bg-primary/15" : "border-border bg-card"}`}
                >
                  {h.emoji}
                </button>
              );
            })}
          </div>
        </div>

        {/* About you — asked once per hobby */}
        {aboutQ && (
          <div className="flex items-center gap-2 rounded-2xl border border-border bg-card px-4 py-2.5">
            <span className="text-xl">{hobby(interest).emoji}</span>
            <input
              value={about}
              onChange={(e) => setAboutState(e.target.value)}
              onBlur={() => { setAbout(interest, about); if (about.trim()) compose(); }}
              onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
              placeholder={aboutQ}
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
            />
          </div>
        )}

        {deck.red.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center space-y-4">
            <div className="text-5xl">🔴</div>
            <p className="text-muted-foreground">0</p>
            <Button onClick={() => navigate("/discover")}>📖🎬 <ArrowRight className="w-4 h-4 ml-1" /></Button>
          </div>
        ) : (
          <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 space-y-5">
            {/* The incentive */}
            <div className="min-h-[2rem] text-lg font-semibold">
              {composing ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : composed?.prompt || `${hobby(interest).emoji} …`}
            </div>

            {/* Red words to use (1–2) */}
            <div className="flex flex-wrap gap-2">
              {pair.map((w) => (
                <WordChip
                  key={w.id}
                  word={w.word}
                  sub={w.translation}
                  colour={COLOUR_HEX[(promoted[w.word] as keyof typeof COLOUR_HEX) || "red"]}
                  done={usesWord(text, w.word)}
                />
              ))}
            </div>

            {/* Green words you already know */}
            {greenHints.length > 0 && (
              <div className="flex flex-wrap gap-1.5" translate="no">
                {greenHints.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setText((t) => (t && !/\s$/.test(t) ? `${t} ${g}` : `${t}${g}`))}
                    className="rounded-full px-2.5 py-0.5 text-sm border"
                    style={{ borderColor: `${COLOUR_HEX.green}66`, color: COLOUR_HEX.green }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}

            {/* Write */}
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setResult(null); }}
                rows={3}
                lang={lang}
                translate="no"
                autoFocus
                placeholder="✍️"
                className="text-lg rounded-2xl min-h-[110px]"
              />
            </div>

            {/* Live colours: your sentence, painted by your decks */}
            {text.trim() && (
              <p className="text-lg leading-relaxed" translate="no" aria-live="polite">
                {tokenize(text).map((p, i) => {
                  if (!p.word) return <span key={i}>{p.text}</span>;
                  const c = colourOf(deck, p.text);
                  return (
                    <span key={i} style={{ color: c ? COLOUR_HEX[c] : undefined, fontWeight: c === "red" ? 700 : undefined }}>
                      {p.text}
                    </span>
                  );
                })}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={check} disabled={!text.trim() || checking} size="lg" className="rounded-2xl" aria-label="Check">
                {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : "✓"}
              </Button>
              <Button variant="outline" size="lg" className="rounded-2xl" onClick={() => setHint((h) => !h)} disabled={!composed} title="Example">
                <Lightbulb className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="lg" className="rounded-2xl" onClick={nextRound} title="New words">
                <RotateCcw className="w-4 h-4" />
              </Button>
              {error && <span className="text-sm text-destructive">{error}</span>}
            </div>

            {/* Example LinguaScript */}
            {hint && composed && !result && (
              <div className="rounded-2xl border border-dashed border-primary/50 p-4 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold" translate="no">{composed.linguascript}</p>
                  <button onClick={() => speak(composed.linguascript, lang)} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Listen">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">{composed.translation}</p>
              </div>
            )}

            {/* Result: your LinguaScript */}
            {result && (
              <div
                className="rounded-2xl p-4 space-y-2 border-2"
                style={{ borderColor: COLOUR_HEX[result.score >= 30 ? "green" : result.score >= 15 ? "orange" : "red"] }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black" style={{ color: COLOUR_HEX[result.score >= 30 ? "green" : result.score >= 15 ? "orange" : "red"] }}>
                    +{result.score}
                  </span>
                  <p className="text-sm text-muted-foreground flex-1">{result.feedback}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold" translate="no">{result.corrected}</p>
                  <button onClick={() => speak(result.corrected, lang)} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Listen">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                {result.translation && <p className="text-sm text-muted-foreground">{result.translation}</p>}
                <div className="pt-1">
                  <Button onClick={nextRound} className="rounded-2xl">
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* My LinguaScripts */}
        {mine.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold tracking-widest text-muted-foreground">LINGUASCRIPTS · {mine.length}</h2>
            <ul className="space-y-2">
              {mine.slice(0, 12).map((m, i) => (
                <li key={i} className="rounded-2xl border border-border bg-card px-4 py-3 flex items-start gap-3">
                  <span className="text-lg">{hobby(m.interest).emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium" translate="no">
                      {tokenize(m.text).map((p, j) =>
                        p.word && m.words.some((w) => w.toLowerCase() === p.text.toLowerCase()) ? (
                          <b key={j} style={{ color: COLOUR_HEX.orange }}>{p.text}</b>
                        ) : (
                          <span key={j}>{p.text}</span>
                        ),
                      )}
                    </p>
                    {m.translation && <p className="text-sm text-muted-foreground truncate">{m.translation}</p>}
                  </div>
                  <button onClick={() => speak(m.text, lang)} className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Listen">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
