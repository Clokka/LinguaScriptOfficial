// The video player's loading screen while subtitles load.
//
//  · While loading: the designs in config.filmLoader.designs show IN ORDER and
//    round again (default: "Through the languages → LinguaScript" decoder, then
//    the Chameleon Method screen, then the decoder again…). Lab designs and the
//    other decoders can be added in HQ (Go live → Video loading screens).
//  · When the subtitles are ready: one short "loading → playing" motion
//    (loading-motion lab), then the video. Reduced motion → no reveal.
// The same alternating screen is used while the pre-teach card finds the key words.
//
// No blank gaps: a lab design is an iframe that needs a second or two to load, so the next design is
// loaded UNDER the current one and only fades in once it says it is ready (the old one stays until then).
// The reveal (the "curtain") is layered over the loader the same way.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChameleonLoader } from "@/components/ChameleonLoader";
import { loadKit } from "@/lib/site/kit";
import { getFilmLoader, type FilmLoaderConfig } from "@/lib/site/config";

const REVEAL_MS = 1800;
const pick = (list: string[]) => (list.length ? list[Math.floor(Math.random() * list.length)] : null);
const srcOf = (id: string) => {
  const [, lab, n] = id.split(":");
  return `/brand/${lab}.html#only=${Number(n) | 0}&live=1&fit=1`;
};

/** How long each design shows before the next one takes over (ms). */
// A design with the three "Finding subtitles / Translating / Colouring your words" bubbles
// must stay until all three are loaded, so those get longer: "decode:languages" finishes its
// third step and its colour change at ~6 s, and a lab design with steps tells us (see `hold`).
const showFor = (id: string) => (id === "chameleon" ? 3600 : id.startsWith("decode:") ? (id === "decode:languages" ? 6800 : 4200) : 4600);

/** The decoding loaders (Studio kit): "Through the languages → LinguaScript" with the three steps under it. */
function DecodeScreen({ variant, onReady }: { variant: string; onReady?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    loadKit().then((kit) => {
      if (alive && host.current) { kit.playLoader(host.current, variant, { steps: true, autoHide: false }); onReady?.(); }
    }).catch(() => {});
    return () => { alive = false; window.LSKit?.stopLive(); };
  }, [variant]);
  return (
    <div className="lsk absolute inset-0 z-30 overflow-hidden bg-[#050607]" aria-busy="true" aria-label="Loading the video">
      <div ref={host} className="ldr" style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

/** One design, framed to fill the player. Sends the real status as its caption. */
export function FilmLoaderScreen({ id, status, onHold, onReady }: { id: string; status?: string; onHold?: (ms: number) => void; onReady?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const said = useRef(false);
  const ready = () => { if (!said.current) { said.current = true; onReady?.(); } };
  // The built-in screens are ready at once; a lab design says so when it has drawn (or after 3.5 s at most, so we never wait forever).
  useEffect(() => {
    if (id === "chameleon") { ready(); return; }
    if (id.startsWith("decode:")) return; // DecodeScreen tells us
    const t = setTimeout(ready, 3500);
    return () => clearTimeout(t);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = () => { if (status) frame.current?.contentWindow?.postMessage({ lsCap: status }, window.location.origin); };
  useEffect(send); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow) {
        if (e.data?.lsCapReady) send();
        if (e.data?.lsSolo) ready();
        // A lab design with the three steps says how long it needs before it may be swapped out.
        if (typeof e.data?.hold === "number" && e.data.hold > 0) onHold?.(Math.min(e.data.hold, 10000));
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });
  if (id === "chameleon") return <ChameleonLoader message={status || "Getting your video ready…"} />;
  if (id.startsWith("decode:")) return <DecodeScreen variant={id.slice(7)} onReady={ready} />;
  return (
    <div className="absolute inset-0 z-30 overflow-hidden bg-[#050607]" aria-busy="true" aria-label={status || "Loading the video"}>
      <iframe ref={frame} key={id} title="Loading" src={srcOf(id)} tabIndex={-1}
        className="absolute inset-0 h-full w-full border-0 pointer-events-none" />
    </div>
  );
}

/**
 * Shows the designs one after another, round and round, until the parent swaps
 * it for something else. One design just stays on screen.
 */
type Layer = { key: string; id: string; ready: boolean };

export function AlternatingLoader({ status, config }: { status?: string; config?: FilmLoaderConfig }) {
  const designs = useMemo(() => {
    const d = (config ?? getFilmLoader()).designs;
    return d.length ? d : ["lab:loading-screens:51", "lab:loading-screens:71", "lab:loading-screens:1"];
  }, [config]);
  // Layers stack up: the newest is on top and fades in once it has drawn itself. Each layer keeps its own
  // element for its whole life (keyed), so the one underneath is never reloaded and nothing flashes black.
  const [layers, setLayers] = useState<Layer[]>(() => [{ key: "0", id: designs[0], ready: false }]);
  const [hold, setHold] = useState(0); // ms the top design must stay (its steps must finish first)
  const counter = useRef(1);
  const shownAt = useRef(Date.now());
  const top = layers[layers.length - 1];
  const topReady = top.ready;
  const topKey = top.key;
  const topId = top.id;
  const onReady = (key: string) => setLayers((ls) => ls.map((l) => (l.key === key ? { ...l, ready: true } : l)));
  useEffect(() => { if (topReady) shownAt.current = Date.now(); }, [topReady, topKey]);
  // Once the top layer is up, drop everything under it.
  useEffect(() => {
    if (!topReady || layers.length < 2) return;
    const t = setTimeout(() => setLayers((ls) => ls.slice(-1)), 700);
    return () => clearTimeout(t);
  }, [topReady, layers.length]);
  // Add the next design a while after THIS one became visible (not after it started loading).
  useEffect(() => {
    if (designs.length < 2 || !topReady) return;
    const wait = Math.max(showFor(topId), hold) - (Date.now() - shownAt.current);
    const t = setTimeout(() => {
      const n = counter.current++;
      const idx = (designs.indexOf(topId) + 1) % designs.length;
      setHold(0);
      setLayers((ls) => [...ls, { key: String(n), id: designs[idx], ready: false }]);
    }, Math.max(0, wait));
    return () => clearTimeout(t);
  }, [topReady, topKey, topId, designs, hold]);
  return (
    <div className="absolute inset-0 z-30 overflow-hidden bg-[#050607]">
      {/* Only while the very first design is still loading: the chameleon, so the first second is never empty. */}
      {layers.length === 1 && !layers[0].ready && (
        <img src="/logo.svg" alt="" className="absolute left-1/2 top-1/2 h-14 w-auto -translate-x-1/2 -translate-y-1/2 animate-pulse" style={{ zIndex: 0 }} />
      )}
      {layers.map((l, n) => (
        <div key={l.key} className="absolute inset-0 transition-opacity duration-500" style={{ zIndex: n + 1, opacity: l.ready ? 1 : 0 }}>
          <FilmLoaderScreen id={l.id} status={status} onHold={n === layers.length - 1 ? setHold : undefined} onReady={() => onReady(l.key)} />
        </div>
      ))}
    </div>
  );
}

/**
 * Shows the loading design until `ready`, plays the reveal, then `children`
 * (the pre-teach card). Like the old ChameleonLoader, calls onComplete after
 * `duration` ms if subtitles never arrive, so the video can still play.
 */
export function FilmLoadingGate({ ready, status, onComplete, duration, children, config }: {
  ready: boolean; status?: string; onComplete: () => void; duration: number; children: ReactNode; config?: FilmLoaderConfig;
}) {
  const cfg = useMemo(() => config ?? getFilmLoader(), [config]);
  const reveal = useMemo(
    () => (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? null : pick(cfg.reveals)),
    [cfg],
  );
  const [phase, setPhase] = useState<"loading" | "reveal" | "done">(ready ? "done" : "loading");
  const [revealUp, setRevealUp] = useState(false); // the reveal has drawn itself over the loader

  useEffect(() => {
    if (!ready || phase !== "loading") return;
    if (!reveal) { setPhase("done"); return; }
    setPhase("reveal");
  }, [ready, phase, reveal]);
  useEffect(() => {
    if (phase !== "reveal") return;
    // The reveal's clock starts when it is visible; if it never says so, don't hold the video back for long.
    const t = setTimeout(() => setPhase("done"), revealUp ? REVEAL_MS : 4500);
    return () => clearTimeout(t);
  }, [phase, revealUp]);
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(onComplete, duration);
    return () => clearTimeout(t);
  }, [phase, duration, onComplete]);

  if (phase === "done") return <>{children}</>;
  if (phase === "reveal" && reveal) {
    // Keep the loader on screen until the reveal is ready, then let it sweep over the top: no blank in between.
    return (
      <>
        <AlternatingLoader status={status} config={cfg} />
        <div className="absolute inset-0 z-40 transition-opacity duration-300" style={{ opacity: revealUp ? 1 : 0 }}>
          <FilmLoaderScreen id={reveal} onReady={() => setRevealUp(true)} />
        </div>
      </>
    );
  }
  return <AlternatingLoader status={status} config={cfg} />;
}
