// Rainforest Browse — alternate /browse experience.
// Live 3D gecko (real GLB from public/pets/), leaf filters, film trail,
// and word-saving wired into the real XP system.
import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { PetLive, PetLiveHandle } from "@/components/pets/PetLive";
import { useXp } from "@/contexts/XpContext";
import "./browse2.css";

type Film = { title: string; level: string; dur: string; pct: number };
type WordState = 0 | 1 | 2; // new, learning, known

const FILMS: Record<string, Film[]> = {
  French: [
    { title: "Le Fabuleux Voyage", level: "B1", dur: "1h 52m", pct: 78 },
    { title: "La Cité des Enfants", level: "B2", dur: "1h 45m", pct: 34 },
    { title: "Un Été à Paris", level: "A2", dur: "24m", pct: 100 },
    { title: "Le Chef de Minuit", level: "B1", dur: "31m", pct: 62 },
    { title: "Contes de la Forêt", level: "A1", dur: "18m", pct: 91 },
    { title: "Nuits de Marseille", level: "C1", dur: "2h 04m", pct: 12 },
  ],
  Spanish: [
    { title: "La Casa del Sol", level: "A2", dur: "26m", pct: 84 },
    { title: "Viento del Sur", level: "B1", dur: "1h 38m", pct: 47 },
    { title: "El Mercado", level: "A1", dur: "15m", pct: 96 },
    { title: "Sombras de Madrid", level: "C1", dur: "1h 58m", pct: 8 },
  ],
  German: [
    { title: "Der Grüne Wald", level: "A2", dur: "22m", pct: 73 },
    { title: "Berlin bei Nacht", level: "B2", dur: "1h 41m", pct: 29 },
    { title: "Die Bäckerei", level: "A1", dur: "17m", pct: 88 },
  ],
  Italian: [
    { title: "Estate Romana", level: "A2", dur: "28m", pct: 67 },
    { title: "Il Treno di Notte", level: "B1", dur: "1h 22m", pct: 41 },
    { title: "La Nonna", level: "A1", dur: "19m", pct: 93 },
  ],
  Japanese: [
    { title: "春の物語", level: "A2", dur: "25m", pct: 58 },
    { title: "東京の朝", level: "B1", dur: "44m", pct: 36 },
    { title: "小さな庭", level: "A1", dur: "16m", pct: 81 },
  ],
};

const SUBS: Record<string, [string, WordState][]> = {
  French: [["Je", 2], ["voudrais", 2], ["apprendre", 1], ["davantage", 0], ["avec", 2], ["toi", 0]],
  Spanish: [["Quiero", 2], ["aprender", 1], ["mucho", 0], ["más", 2], ["contigo", 0]],
  German: [["Ich", 2], ["möchte", 1], ["mehr", 0], ["lernen", 2]],
  Italian: [["Voglio", 2], ["imparare", 1], ["di", 2], ["più", 0]],
  Japanese: [["もっと", 0], ["学び", 1], ["たい", 2]],
};

const LANGS = Object.keys(FILMS);
const WORD_CLS = ["w-new", "w-learning", "w-known"];
const LEVEL_HUE: Record<string, number> = { A1: 150, A2: 130, B1: 90, B2: 45, C1: 280 };
const PET_MSGS = [
  "Two more words to level 8!",
  "Click me — I do tricks.",
  "Tonight's film awaits 🎬",
  "Your canopy is growing!",
];
const TRICKS = ["Bounce", "Spin", "Jump", "Roll"];

const parseMin = (s: string) =>
  s.includes("h") ? parseInt(s) * 60 + (parseInt(s.split("h")[1]) || 0) : parseInt(s);

export default function Browse2() {
  const { award } = useXp();
  const petRef = useRef<PetLiveHandle>(null);
  const [lang, setLang] = useState("French");
  const [shortOnly, setShortOnly] = useState(false);
  const [almostOnly, setAlmostOnly] = useState(false);
  const [gems, setGems] = useState(1240);
  const [canopy, setCanopy] = useState(43);
  const [petMsg, setPetMsg] = useState("Loading…");
  const [openFilm, setOpenFilm] = useState<Film | null>(null);
  const [words, setWords] = useState<[string, WordState][]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [lockShake, setLockShake] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();
  const msgIdx = useRef(0);

  const films = useMemo(() => {
    let list = FILMS[lang] ?? [];
    if (shortOnly) list = list.filter((f) => parseMin(f.dur) < 30);
    if (almostOnly) list = list.filter((f) => f.pct >= 40 && f.pct < 100);
    return list;
  }, [lang, shortOnly, almostOnly]);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const open = (film: Film) => {
    setWords((SUBS[lang] ?? SUBS.French).map(([w, s]) => [w, s]));
    setOpenFilm(film);
  };

  const saveWord = (idx: number) => {
    const [word, state] = words[idx];
    if (state !== 0) return;
    setWords((prev) => prev.map((w, i) => (i === idx ? [w[0], 1] : w)));
    setGems((g) => g + 2);
    setCanopy((c) => Math.min(100, c + 1));
    petRef.current?.play("Bounce");
    setPetMsg("Word saved! +20 XP 🎉");
    award("add_word");
    showToast(`+20 XP · "${word}" saved to flashcards`);
  };

  const pokePet = () => {
    petRef.current?.play(TRICKS[Math.floor(Math.random() * TRICKS.length)]);
    msgIdx.current = (msgIdx.current + 1) % PET_MSGS.length;
    setPetMsg(PET_MSGS[msgIdx.current]);
  };

  return (
    <div className="b2">
      <div className="canopy">
        <img className="jungle" src="/rainforest/jungle.jpg" alt="" />
        <svg className="canopyfringe" viewBox="0 0 1440 70" preserveAspectRatio="none" width="100%" height="70">
          <path d="M0,0 L1440,0 L1440,18 Q1400,55 1350,22 Q1320,60 1270,25 Q1230,68 1180,20 Q1150,52 1100,24 Q1060,66 1010,18 Q980,50 930,26 Q890,64 840,20 Q810,54 760,24 Q720,68 670,18 Q640,50 590,26 Q550,62 500,20 Q470,55 420,24 Q380,66 330,18 Q300,50 250,26 Q210,62 160,20 Q130,52 80,26 Q45,60 0,16 Z"
            fill="#0c1f14" opacity="0.94" />
        </svg>
        <nav className="nav">
          <div className="logo">Lingua<b>Script</b></div>
          <Link to="/browse" className="active">Discover</Link>
          <Link to="/flashcards">Flashcards</Link>
          <Link to="/progress">Progress</Link>
          <Link to="/friends">Friends</Link>
          <span className="pill gemsPill">
            <img src="/rainforest/gems.png" alt="gems" />{gems.toLocaleString()}
          </span>
          <span className="pill streakPill">🔥 12</span>
        </nav>
        <div className="heroinner">
          <div>
            <h1>Pick tonight's film.<br />Watching <b>is</b> the lesson.</h1>
            <p>Your {lang} canopy is <b>{canopy}%</b> green. Every film you finish grows it.</p>
          </div>
          <button className="companion" onClick={pokePet} title="Say hi to Gecko">
            <div className="petstage">
              <PetLive
                ref={petRef}
                glbFile="/pets/Gecko_Animations.glb"
                size={110}
                onReady={() => setPetMsg(PET_MSGS[0])}
              />
            </div>
            <div>
              <div className="cname">Gecko <span>· live 3D</span></div>
              <div className="cmsg">{petMsg}</div>
            </div>
          </button>
        </div>
      </div>

      <div className="wrap">
        <div className="filters">
          {LANGS.map((l) => (
            <button key={l} className={`leaf ${lang === l ? "on" : ""}`} onClick={() => setLang(l)}>
              {lang === l ? "🌿 " : ""}{l}
            </button>
          ))}
          <button className={`leaf ${shortOnly ? "on" : ""}`} onClick={() => setShortOnly(!shortOnly)}>
            Under 30 min
          </button>
          <button className={`leaf ${almostOnly ? "on" : ""}`} onClick={() => setAlmostOnly(!almostOnly)}>
            Almost green
          </button>
        </div>

        <h2>Your trail — Forest Floor to Canopy</h2>
        <p className="sub">A curated ladder of films at your level. Finish one to unlock the next clearing.</p>
        <div className="trail">
          <h3>Beginner Trail · {lang} A2</h3>
          <div className="tsub">3 of 5 films fully green · reward: the Muskrat companion 🥚</div>
          <div className="path">
            <button className="node g">✓</button><div className="vine done" />
            <button className="node g">✓</button><div className="vine done" />
            <button className="node g">✓</button><div className="vine" />
            <button className="node o" onClick={() => open({ title: "Le Chef de Minuit", level: "B1", dur: "31m", pct: 62 })}>62%</button>
            <div className="vine" />
            <button
              className={`node locked ${lockShake ? "shake" : ""}`}
              onClick={() => {
                setLockShake(false);
                requestAnimationFrame(() => setLockShake(true));
                showToast("Finish the trail to unlock this clearing 🔒");
              }}
            >🔒</button>
          </div>
        </div>

        <h2>Almost green 🌱</h2>
        <p className="sub">Films where one more watch flips the score — the fastest wins in the forest.</p>
        <div className="grid">
          {films.length === 0 && (
            <div className="empty">No films match these leaves — try removing a filter 🍃</div>
          )}
          {films.map((f) => {
            const color = f.pct >= 90 ? "var(--b2-green)" : f.pct >= 40 ? "var(--b2-orange)" : "var(--b2-red)";
            return (
              <button key={f.title} className="film" onClick={() => open(f)}>
                <div className="thumb" style={{ "--h": LEVEL_HUE[f.level] ?? 200 } as React.CSSProperties}>
                  <span className="dur">{f.dur}</span>
                  <span className="lvl">{f.level}</span>
                  <div className="playbtn">▶</div>
                </div>
                <div className="fb">
                  <h3>{f.title}</h3>
                  <div className="meter"><i style={{ width: `${f.pct}%`, background: color }} /></div>
                  {f.pct === 100 ? (
                    <span style={{ color: "var(--b2-green)" }}>✓ 100% — watch again</span>
                  ) : f.pct >= 40 ? (
                    <span style={{ color: "var(--b2-orange)" }}>Continue — {f.pct}% understood</span>
                  ) : (
                    <span style={{ color: "var(--b2-red)" }}>{f.pct}% — new territory</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <footer>
          Rainforest Browse concept — live 3D gecko from the real Gecko_Animations.glb · word saves award
          real XP · palette grown from the Mieo jungle world
        </footer>
      </div>

      {openFilm && (
        <div className="modal" onClick={(e) => e.target === e.currentTarget && setOpenFilm(null)}>
          <div className="sheet">
            <button className="x" onClick={() => setOpenFilm(null)}>✕</button>
            <h3>{openFilm.title}</h3>
            <div className="meta">{lang} · {openFilm.level} · {openFilm.dur} · {openFilm.pct}% understood</div>
            <div className="screen">
              <div className="subline">
                {words.map(([w, s], i) => (
                  <button key={`${w}-${i}`} className={WORD_CLS[s]} onClick={() => saveWord(i)}>
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <p className="tip"><b>Click a red word</b> to save it to flashcards — your gecko reacts, +20 XP, +2 gems.</p>
          </div>
        </div>
      )}

      {toast && <div className="toastmsg">{toast}</div>}
    </div>
  );
}
