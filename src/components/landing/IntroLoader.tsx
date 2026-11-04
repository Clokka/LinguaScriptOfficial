// The intro loading screen chosen in HQ, played over the homepage before the
// page shows: one of the four decoding loaders (Studio kit) or any of the
// 142 loading-lab designs. Lazy chunk. Always skippable (button, Esc, tap),
// never longer than ~5 s, and skipped for people who ask for reduced motion.
// End "button" waits for "Enter LinguaScript" instead of fading by itself.
import { useEffect, useRef, useState } from "react";
import { loadKit } from "@/lib/site/kit";
import { Button } from "@/components/ui/button";
import "@/components/premium/cinema.css";

const MAX_MS = 5200;

export default function IntroLoader({ loader, end, onDone }: { loader: string; end: "auto" | "button"; onDone: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [showEnter, setShowEnter] = useState(false);
  const isLab = loader.startsWith("lab:");

  const finish = useRef(() => {});
  finish.current = () => {
    if (leaving) return;
    setLeaving(true);
    setTimeout(onDone, 450);
  };

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { onDone(); return; }
    let timer = 0;
    const done = () => (end === "button" ? setShowEnter(true) : finish.current());
    if (isLab) {
      timer = window.setTimeout(done, 4200);
    } else {
      loadKit().then((kit) => {
        if (!host.current) return;
        kit.playLoader(host.current, loader, { steps: true, autoHide: false });
        timer = window.setTimeout(done, loader === "languages" ? MAX_MS : 3800);
      }).catch(() => onDone());
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") finish.current(); };
    window.addEventListener("keydown", onKey);
    return () => { clearTimeout(timer); window.removeEventListener("keydown", onKey); window.LSKit?.stopLive(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader, end]);

  const [, lab, n] = isLab ? loader.split(":") : [];
  return (
    <div
      className={`lsk ls-intro-shell ${leaving ? "ls-intro-leaving" : ""}`}
      role="dialog"
      aria-label="Loading LinguaScript"
    >
      {isLab ? (
        <iframe title="Loading" src={`/brand/${lab}.html#only=${Number(n) | 0}&fit=1`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      ) : (
        <div ref={host} className="ldr" style={{ position: "absolute", inset: 0 }} />
      )}
      <Button variant="outline"
        onClick={() => finish.current()}
        className="absolute right-4 top-4 z-[60]"
      >
        Skip
      </Button>
      {showEnter && (
        <Button size="lg"
          onClick={() => finish.current()}
          autoFocus
          className="absolute left-1/2 top-[calc(50%+110px)] z-[60] -translate-x-1/2"
        >
          Enter LinguaScript →
        </Button>
      )}
    </div>
  );
}
