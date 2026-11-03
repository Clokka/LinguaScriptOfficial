// The intro loading screen chosen in HQ, played over the homepage before the
// page shows: one of the four decoding loaders (Studio kit) or any of the
// 142 loading-lab designs. Lazy chunk. Always skippable (button, Esc, tap),
// never longer than ~5 s, and skipped for people who ask for reduced motion.
// End "button" waits for "Enter LinguaScript" instead of fading by itself.
import { useEffect, useRef, useState } from "react";
import { loadKit } from "@/lib/site/kit";

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
        kit.playLoader(host.current, loader, { steps: false, autoHide: false });
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
      className="lsk"
      role="dialog"
      aria-label="Loading LinguaScript"
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "#050607", transition: "opacity .45s", opacity: leaving ? 0 : 1 }}
    >
      {isLab ? (
        <iframe title="Loading" src={`/brand/${lab}.html#only=${Number(n) | 0}&fit=1`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
      ) : (
        <div ref={host} className="ldr" style={{ position: "absolute", inset: 0 }} />
      )}
      <button
        onClick={() => finish.current()}
        style={{ position: "absolute", top: 16, right: 16, zIndex: 60, background: "#ffffff1a", color: "#fff", border: "1px solid #ffffff33", borderRadius: 999, padding: "8px 16px", font: "600 14px Inter, system-ui, sans-serif" }}
      >
        Skip
      </button>
      {showEnter && (
        <button
          onClick={() => finish.current()}
          autoFocus
          style={{ position: "absolute", left: "50%", top: "calc(50% + 110px)", transform: "translateX(-50%)", zIndex: 60, background: "#34C759", color: "#04130a", border: 0, borderRadius: 999, padding: "16px 30px", font: "800 18px Inter, system-ui, sans-serif", boxShadow: "0 12px 40px #34c75955" }}
        >
          Enter LinguaScript →
        </button>
      )}
    </div>
  );
}
