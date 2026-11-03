// The video player's loading screen while subtitles load, chosen in HQ
// (Go live → Video loading screens). One design per film from the rotation
// (loading-screens / loading-experiences labs, shown through isolate.js with
// the real status as its caption), then a short "loading → playing" motion
// (loading-motion lab) when the subtitles are ready. Defaults to Rowan's
// favourites until HQ publishes a choice. Reduced motion → no reveal.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChameleonLoader } from "@/components/ChameleonLoader";
import { getFilmLoader, type FilmLoaderConfig } from "@/lib/site/config";

const REVEAL_MS = 1800;
const pick = (list: string[]) => (list.length ? list[Math.floor(Math.random() * list.length)] : null);
const srcOf = (id: string) => {
  const [, lab, n] = id.split(":");
  return `/brand/${lab}.html#only=${Number(n) | 0}&live=1`;
};

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
  return (
    <div className="absolute inset-0 z-30 overflow-hidden bg-[#050607]" aria-busy="true" aria-label={status || "Loading the video"}>
      <iframe ref={frame} key={id} title="Loading" src={srcOf(id)} tabIndex={-1}
        className="absolute inset-0 h-full w-full border-0 pointer-events-none" />
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
  const design = useMemo(() => pick(cfg.designs) ?? "chameleon", [cfg]);
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
  return <FilmLoaderScreen id={design} status={status} />;
}
