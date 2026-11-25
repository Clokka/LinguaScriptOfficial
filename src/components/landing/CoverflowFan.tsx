// The interactive "Films you'll actually understand" fan (from the Streaming
// Home lab, design "Cover-flow fan"), used by /landing6.
//  · hobby chips → the cards become picks for that hobby (also read from a
//    guest's onboarding answers, so a returning visitor sees their own hobby)
//  · For you / YouTube / Netflix / Anime / News tabs filter the cards
//  · hover: the card lifts, tilts toward the pointer and "flickers": its
//    subtitle words change red → orange → green, like a chameleon
//  · click a side card to bring it to the front, swipe on phones, ← → keys
//  · the fan opens a little as you scroll
// Cards are clearly labelled examples (no real artwork, platform names as
// text badges). All motion is CSS and stops under prefers-reduced-motion.
import { useEffect, useMemo, useRef, useState } from "react";

export type Plat = "yt" | "nf" | "cr" | "tv";
type Word = [string, "r" | "o" | "g"];
export type FanCard = { title: string; plat: Plat; kind: string; pct: number; hue: number; emoji: string; line: Word[] };

export const FAN_HOBBIES: { id: string; label: string; emoji: string }[] = [
  { id: "football", label: "Football", emoji: "⚽" },
  { id: "cooking", label: "Cooking", emoji: "🍳" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "travel", label: "Travel", emoji: "✈️" },
  { id: "music", label: "Music", emoji: "🎵" },
  { id: "fitness", label: "Fitness", emoji: "🏃" },
  { id: "history", label: "History", emoji: "📚" },
  { id: "comedy", label: "Comedy", emoji: "🎭" },
];

const w = (s: string): Word[] => s.split(" ").map((t) => {
  const m = t.match(/^(.*)\|([rog])$/);
  return m ? [m[1], m[2] as Word[1]] : [t, "g"];
});

// Three example YouTube picks per hobby (topics, not real video titles).
const YT: Record<string, [string, string, string][]> = {
  football: [["The best goals of the season", "⚽", "Quel but|r incroyable|o !"], ["Match day in the stadium", "🏟️", "On a gagné|o le match|r !"], ["Training like a pro", "🥅", "Plus vite|o , encore|r !"]],
  cooking: [["A 10-minute ratatouille", "🍅", "On coupe|r les tomates|o ."], ["Market morning in Lyon", "🧺", "Je voudrais|o du fromage|r ."], ["Perfect crêpes at home", "🥞", "Il faut|o du beurre|r ."]],
  gaming: [["My first night in Minecraft", "⛏️", "Attention|r , il fait|o nuit !"], ["Ranked games, live", "🎮", "On va|o gagner|r ça !"], ["Speedrun tips", "⏱️", "C'est|g trop rapide|r !"]],
  travel: [["48 hours in Marseille", "⛵", "On part|o demain|r matin."], ["Night train to Paris", "🚆", "Le train|o arrive|r bientôt."], ["Hiking in the Alps", "🏔️", "La vue|r est belle|o ."]],
  music: [["The story behind a hit song", "🎤", "J'ai écrit|r cette chanson|o ."], ["Live session in a café", "🎸", "Merci d'être|o venus|r !"], ["Learning the guitar", "🎶", "Encore|o une fois|r ."]],
  fitness: [["A 15-minute morning workout", "🏃", "On respire|r , on continue|o ."], ["My first 10 km run", "👟", "Je suis|g fatigué|r mais content."], ["Stretching for beginners", "🧘", "Doucement|r , très bien|o ."]],
  history: [["Why the castles were built", "🏰", "Le roi|o voulait|r un château."], ["A day in Roman Gaul", "🏛️", "Les Romains|r arrivent|o ."], ["The story of Paris", "🗼", "La ville|o change|r vite."]],
  comedy: [["Stand-up: ordering a coffee", "😂", "Un café|g , s'il|o vous plaît|r !"], ["Office sketch", "💼", "Encore|o une réunion|r ?!"], ["Prank on my brother", "🙃", "Il ne sait|o rien|r !"]],
};
const OTHER: Record<Exclude<Plat, "yt">, [string, string, string, string][]> = {
  nf: [["Lupin", "Series", "🎩", "Je suis|g là pour|o toi|r ."], ["Dix pour cent", "Series", "🎬", "On a un|g problème|r ."], ["Family Business", "Series", "🏪", "C'est|g notre famille|o ."]],
  cr: [["One Piece (VF)", "Anime · French dub", "🏴‍☠️", "Je serai|o le roi|r !"], ["Spy x Family (VF)", "Anime · French dub", "🕵️", "C'est|g un secret|r ."], ["Demon Slayer (VF)", "Anime · French dub", "⚔️", "Je vais|o te protéger|r !"]],
  tv: [["Le journal en français facile", "News", "📰", "Bonjour|g , voici|o les infos|r ."], ["The weather, slowly", "News", "🌦️", "Demain|o , il pleut|r ."], ["The week in 5 minutes", "News", "🗞️", "Cette semaine|o , en France|r …"]],
};

export const PLAT: Record<Plat, [string, string]> = { yt: ["YouTube", "#FF0033"], nf: ["Netflix", "#E50914"], cr: ["Crunchyroll", "#F47521"], tv: ["TV5MONDE", "#2A6FDB"] };
const TABS: [string, string][] = [["all", "For you"], ["yt", "YouTube"], ["nf", "Netflix"], ["cr", "Anime"], ["tv", "News"]];

const pctOf = (s: string) => 72 + ([...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 23);
const hueOf = (s: string) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360;

function cardsFor(hobby: string, tab: string): FanCard[] {
  const yt = (h: string) => (YT[h] ?? YT.football).map(([t, e, l]) => ({ title: t, plat: "yt" as Plat, kind: "YouTube", emoji: e, line: w(l), pct: pctOf(t), hue: hueOf(t) }));
  const other = (p: Exclude<Plat, "yt">) => OTHER[p].map(([t, k, e, l]) => ({ title: t, plat: p as Plat, kind: k, emoji: e, line: w(l), pct: pctOf(t), hue: hueOf(t) }));
  if (tab === "yt") {
    const more = FAN_HOBBIES.filter((h) => h.id !== hobby).slice(0, 4).map((h) => yt(h.id)[0]);
    return [...yt(hobby), ...more];
  }
  if (tab !== "all") return [...other(tab as Exclude<Plat, "yt">), yt(hobby)[0], yt(hobby)[1]];
  const mine = yt(hobby);
  return [other("nf")[0], mine[1], other("cr")[0], mine[0], other("tv")[0], mine[2], other("nf")[1]];
}

/** A hobby the visitor already chose in onboarding, if it's one of ours. */
export function savedHobby(): string | null {
  for (const k of ["ls.onboardingState.v1", "ls.guestOnboarded.v1"]) {
    try {
      const h = JSON.parse(localStorage.getItem(k) || "null")?.interests?.[0];
      if (FAN_HOBBIES.some((x) => x.id === h)) return h;
    } catch { /* private mode */ }
  }
  return null;
}

export function CoverflowFan({ hobby, onHobby, onStart }: { hobby: string; onHobby: (h: string) => void; onStart: (card: FanCard) => void }) {
  const [tab, setTab] = useState("all");
  const cards = useMemo(() => cardsFor(hobby, tab), [hobby, tab]);
  const [active, setActive] = useState(3);
  const box = useRef<HTMLDivElement>(null);
  const swipe = useRef<number | null>(null);
  useEffect(() => { setActive(Math.floor(cards.length / 2)); }, [cards]);

  // The fan opens a little as the page scrolls.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => box.current?.style.setProperty("--open", String(1 + Math.min(window.scrollY / 700, 0.35))));
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);

  const tilt = (e: React.PointerEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--rx", `${((e.clientY - r.top) / r.height - 0.5) * -14}deg`);
    e.currentTarget.style.setProperty("--ry", `${((e.clientX - r.left) / r.width - 0.5) * 14}deg`);
  };
  const untilt = (e: React.PointerEvent<HTMLButtonElement>) => { e.currentTarget.style.setProperty("--rx", "0deg"); e.currentTarget.style.setProperty("--ry", "0deg"); };
  const cur = cards[active] ?? cards[0];

  return (
    <div className="cf">
      <div className="cf-hob" role="group" aria-label="What do you love?">
        <span className="cf-q">What do you love?</span>
        {FAN_HOBBIES.map((h) => (
          <button key={h.id} className={`cf-chip${h.id === hobby ? " on" : ""}`} aria-pressed={h.id === hobby} onClick={() => onHobby(h.id)}>{h.emoji} {h.label}</button>
        ))}
      </div>
      <div className="cf-tabs" role="tablist" aria-label="Where you watch">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`cf-tab${tab === k ? " on" : ""}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      <div ref={box} className="cf-stage" translate="no"
        onKeyDown={(e) => { if (e.key === "ArrowLeft") setActive((a) => Math.max(0, a - 1)); if (e.key === "ArrowRight") setActive((a) => Math.min(cards.length - 1, a + 1)); }}
        onPointerDown={(e) => { swipe.current = e.clientX; }}
        onPointerUp={(e) => {
          const dx = swipe.current === null ? 0 : e.clientX - swipe.current;
          swipe.current = null;
          if (Math.abs(dx) > 40) setActive((a) => Math.max(0, Math.min(cards.length - 1, a + (dx < 0 ? 1 : -1))));
        }}>
        {cards.map((c, i) => {
          const k = i - active;
          return (
            <button key={`${tab}-${hobby}-${c.title}`} className={`cf-card${k === 0 ? " front" : ""}`}
              style={{ "--k": k, "--ak": Math.abs(k), "--h": c.hue, zIndex: 20 - Math.abs(k) } as React.CSSProperties}
              aria-label={`${c.title}, ${PLAT[c.plat][0]}, about ${c.pct}% you'd understand`}
              onPointerMove={tilt} onPointerLeave={untilt}
              onClick={() => (k === 0 ? onStart(c) : setActive(i))}>
              <span className="cf-in">
                <span className="cf-plat" style={{ background: PLAT[c.plat][1] }}>{PLAT[c.plat][0]}</span>
                <span className="cf-ring" style={{ "--p": c.pct } as React.CSSProperties}><b>{c.pct}%</b></span>
                <span className="cf-emoji" aria-hidden>{c.emoji}</span>
                <span className="cf-sub">{c.line.map(([t, d], j) => <span key={j} className={`cf-w ${d}`} style={{ animationDelay: `${j * 0.12}s` }}>{t} </span>)}</span>
                <span className="cf-title" translate="yes">{c.title}</span>
                <span className="cf-kind" translate="yes">{c.kind} · {c.pct}% you'd understand</span>
                <span className="cf-shine" aria-hidden />
              </span>
            </button>
          );
        })}
      </div>

      <div className="cf-cta">
        <button className="cf-go" onClick={() => onStart(cur)}>▶ Try “{cur.title}” · {cur.pct}%</button>
        <span className="cf-note">Examples. Your real list is checked against the words you know.</span>
      </div>
    </div>
  );
}
