import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COLOUR_HEX } from "@/lib/pillars";

/**
 * 🦎 First screen of the phone app (shown on "/" inside the app when nobody is
 * signed in — the website's landing page is for browsers). Full screen, swipe
 * between cards, big thumb buttons at the bottom, no website header/footer,
 * no app-store badges, nothing heavy (SVG chameleon, CSS animations only).
 * "Get started" → /onboarding (language, hobby, goal, try words as a guest,
 * then sign up). "I already have an account" → /auth.
 */
const isInApp = () => typeof window !== "undefined" && !!(window as Window & { ReactNativeWebView?: unknown }).ReactNativeWebView;
export { isInApp };

const C = COLOUR_HEX;

/** A subtitle line whose words settle into their deck colours. */
function SubtitleDemo() {
  const words: [string, string][] = [["Je", C.green], ["voudrais", C.orange], ["un", C.green], ["café", C.red], ["s'il", C.green], ["vous", C.green], ["plaît", C.gold]];
  return (
    <div className="w-full rounded-2xl bg-black/80 p-4 ring-1 ring-white/10">
      <div className="mb-3 aspect-video w-full rounded-xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
      <p translate="no" className="text-center text-xl font-extrabold leading-snug">
        {words.map(([w, c], i) => (
          <span key={w} className="ls-welcome-word" style={{ color: c, animationDelay: `${0.3 + i * 0.25}s` }}>{w} </span>
        ))}
      </p>
      <p className="mt-1 text-center text-sm text-white/80">I'd like a coffee, please</p>
    </div>
  );
}

/** The 🦎 bubble over a video, one word tapped: meaning + Save. */
function TapDemo() {
  return (
    <div className="relative w-full rounded-2xl bg-black/80 p-4 ring-1 ring-white/10">
      <div className="aspect-video w-full rounded-xl bg-gradient-to-br from-rose-900/70 via-slate-800 to-slate-900" />
      <p translate="no" className="mt-3 text-center text-lg font-bold text-white">
        Me encanta esta <span className="rounded px-1 ring-2" style={{ color: C.red, boxShadow: `0 0 0 2px ${C.red}` }}>canción</span>
      </p>
      <div className="mx-auto mt-3 w-56 rounded-xl bg-white p-3 text-slate-900 shadow-xl">
        <p translate="no" className="font-bold">canción</p>
        <p className="text-sm text-slate-600">song</p>
        <div className="mt-2 rounded-lg py-1.5 text-center text-sm font-bold text-white" style={{ background: C.red }}>＋ Save</div>
      </div>
      <img src="/logo.svg" alt="" className="absolute right-3 top-3 h-11 w-11 rounded-full bg-black p-1.5 ring-2" style={{ boxShadow: `0 0 0 2px ${C.green}` }} />
    </div>
  );
}

/** A gold word waiting on the lock screen. */
function GoldDemo() {
  return (
    <div className="w-full rounded-[2rem] bg-gradient-to-b from-indigo-950 to-slate-950 p-5 ring-1 ring-white/10">
      <p className="text-center text-5xl font-light tabular-nums text-white">9:41</p>
      <p className="mb-6 text-center text-sm text-white/60">Monday</p>
      <div className="rounded-2xl bg-white/10 p-3 backdrop-blur">
        <p className="text-xs text-white/60">LinguaScript</p>
        <p translate="no" className="text-lg font-bold" style={{ color: C.gold }}>✨ maison</p>
        <p className="text-sm text-white/80">Do you remember it?</p>
        <p className="mt-2 text-sm font-semibold text-white">Show meaning → house 🎉</p>
      </div>
    </div>
  );
}

const CARDS = [
  { title: "Learn a language from what you already watch", body: "Films, YouTube, shows you love — LinguaScript turns them into your lesson.", demo: null },
  { title: "Every word shows how well you know it", body: "Red is new, orange is learning, green is known. Watch the screen turn green.", demo: <SubtitleDemo /> },
  { title: "Tap any word, anywhere", body: "YouTube, Chrome, WhatsApp — tap the 🦎, tap a word, save it.", demo: <TapDemo /> },
  { title: "2 minutes a day", body: "Gold words are ones you already know, back for a quick review. “I knew that!”", demo: <GoldDemo /> },
];

export function AppWelcome() {
  const navigate = useNavigate();
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const last = page >= CARDS.length - 1;
  const next = () => {
    const el = track.current;
    if (!el) return;
    if (last) { navigate("/onboarding"); return; }
    el.scrollTo({ left: (page + 1) * el.clientWidth, behavior: "smooth" });
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-[#08080B] text-white" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <style>{`
        @keyframes lsChameleon { 0% { filter: hue-rotate(-120deg) } 45% { filter: hue-rotate(-80deg) } 80%,100% { filter: hue-rotate(0deg) } }
        @keyframes lsBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
        @keyframes lsWord { from { color: #fff; opacity: .35 } }
        .ls-welcome-word { animation: lsWord .6s ease-out both }
        .ls-welcome-track::-webkit-scrollbar { display: none }
        @media (prefers-reduced-motion: reduce) { .ls-welcome-anim, .ls-welcome-word { animation: none !important } }
      `}</style>

      <div className="flex items-center justify-between px-5 pt-4">
        <span className="text-lg font-extrabold tracking-tight">Lingua<span style={{ color: C.green }}>Script</span></span>
        {!last && (
          <button className="text-sm font-semibold text-white/60" onClick={() => navigate("/onboarding")}>Skip</button>
        )}
      </div>

      <div ref={track} className="ls-welcome-track flex flex-1 snap-x snap-mandatory overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {CARDS.map((card, i) => (
          <section key={card.title} className="flex w-full shrink-0 snap-center flex-col items-center justify-center gap-6 px-6 text-center">
            {i === 0 ? (
              <img
                src="/logo.svg"
                alt=""
                className="ls-welcome-anim h-40 w-40"
                style={{ animation: "lsChameleon 4s ease-in-out infinite alternate, lsBob 3s ease-in-out infinite", filter: "drop-shadow(0 0 30px rgba(52,199,89,.35))" }}
              />
            ) : (
              <div className="w-full max-w-sm">{card.demo}</div>
            )}
            <div className="max-w-sm space-y-2">
              <h1 className="text-3xl font-black leading-tight">{card.title}</h1>
              <p className="text-base text-white/70">{card.body}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="space-y-3 px-6 pb-6 pt-2">
        <div className="flex justify-center gap-2" aria-hidden>
          {CARDS.map((c, i) => (
            <span key={c.title} className="h-2 rounded-full transition-all" style={{ width: i === page ? 24 : 8, background: i === page ? C.green : "rgba(255,255,255,.25)" }} />
          ))}
        </div>
        <button
          onClick={next}
          className="h-14 w-full rounded-2xl text-lg font-extrabold text-black active:scale-[.98]"
          style={{ background: C.green }}
        >
          {page === 0 ? "Get started" : last ? "Start learning" : "Next"}
        </button>
        <button onClick={() => navigate("/auth")} className="h-11 w-full text-sm font-semibold text-white/70">
          I already have an account
        </button>
      </div>
    </div>
  );
}
