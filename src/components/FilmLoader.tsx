// The video player's loading screen while subtitles load.
//
//  · While loading: the designs in config.filmLoader.designs show IN ORDER and
//    round again (default: "Through the languages → LinguaScript" decoder, then
//    the Chameleon Method screen, then the decoder again…). Lab designs and the
//    other decoders can be added in HQ (Go live → Video loading screens).
//  · When the subtitles are ready: one short "loading → playing" motion
//    (loading-motion lab), then the video. Reduced motion → no reveal.
// The same alternating screen is used while the pre-teach card finds the key words.
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
const showFor = (id: string) => (id === "chameleon" ? 3600 : id.startsWith("decode:") ? (id === "decode:languages" ? 5600 : 4200) : 4600);

/** The decoding loaders (Studio kit): "Through the languages → LinguaScript" with the three steps under it. */
function DecodeScreen({ variant }: { variant: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let alive = true;
    loadKit().then((kit) => {
      if (alive && host.current) kit.playLoader(host.current, variant, { steps: true, autoHide: false });
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
export function FilmLoaderScreen({ id, status }: { id: string; status?: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const send = () => { if (status) frame.current?.contentWindow?.postMessage({ lsCap: status }, window.location.origin); };
  useEffect(send); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.lsCapReady) send();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });
  if (id === "chameleon") return <ChameleonLoader message={status || "Getting your video ready…"} />;
  if (id.startsWith("decode:")) return <DecodeScreen variant={id.slice(7)} />;
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
export function AlternatingLoader({ status, config }: { status?: string; config?: FilmLoaderConfig }) {
  const designs = useMemo(() => {
    const d = (config ?? getFilmLoader()).designs;
    return d.length ? d : ["decode:languages", "chameleon"];
  }, [config]);
  const [i, setI] = useState(0);
  const [round, setRound] = useState(0); // remounts a design that comes round again so it replays
  const id = designs[i % designs.length];
  useEffect(() => {
    if (designs.length < 2) return;
    const t = setTimeout(() => { setI((n) => (n + 1) % designs.length); setRound((r) => r + 1); }, showFor(id));
    return () => clearTimeout(t);
  }, [i, id, designs.length]);
  return <FilmLoaderScreen key={`${id}-${round}`} id={id} status={status} />;
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

  useEffect(() => {
    if (!ready || phase !== "loading") return;
    if (!reveal) { setPhase("done"); return; }
    setPhase("reveal");
  }, [ready, phase, reveal]);
  useEffect(() => {
    if (phase !== "reveal") return;
    const t = setTimeout(() => setPhase("done"), REVEAL_MS);
    return () => clearTimeout(t);
  }, [phase]);
  useEffect(() => {
    if (phase !== "loading") return;
    const t = setTimeout(onComplete, duration);
    return () => clearTimeout(t);
  }, [phase, duration, onComplete]);

  if (phase === "done") return <>{children}</>;
  if (phase === "reveal" && reveal) return <FilmLoaderScreen id={reveal} />;
  return <AlternatingLoader status={status} config={cfg} />;
}
