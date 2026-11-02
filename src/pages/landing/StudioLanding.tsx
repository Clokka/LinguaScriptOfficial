// A homepage built in the Site Studio and published from HQ. Lazy chunk:
// only visitors who get a Studio homepage download it, plus the Studio kit
// (public/brand/studio-kit.*, ~50 kB) and the lab blocks the page uses.
// Every button works: "Start free" style buttons → onboarding, nav and
// footer links → their pages, and buttons inside lab blocks report back
// through isolate.js (&live=1) and are checked against SAFE_ROUTES.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageLoading } from "@/components/PageLoading";
import { trackAll } from "@/lib/experiments";
import { loadKit } from "@/lib/site/kit";
import { routeForText, SAFE_ROUTES, type SitePage } from "@/lib/site/config";
import Landing5 from "@/pages/Landing5";

const CLICKABLE = ".b1,.b2,.go,.door,.vc,.nav .lg,.nav .links span,.foot span";

export default function StudioLanding({ page }: { page: Extract<SitePage, { kind: "studio" }> }) {
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");

  useEffect(() => {
    let alive = true;
    loadKit().then((kit) => {
      if (!alive || !ref.current) return;
      kit.renderLive(ref.current, page);
      ref.current.querySelectorAll<HTMLElement>(CLICKABLE).forEach((el) => {
        el.setAttribute("role", "link");
        el.tabIndex = 0;
        el.style.cursor = "pointer";
      });
      setState("ok");
    }).catch(() => alive && setState("failed"));
    return () => { alive = false; window.LSKit?.stopLive(); };
  }, [page]);

  useEffect(() => {
    const go = (path: string) => {
      if (!SAFE_ROUTES.includes(path)) return;
      if (path === "/onboarding") trackAll("cta");
      navigate(path);
    };
    const onMsg = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data) return;
      const frames = ref.current?.querySelectorAll<HTMLIFrameElement>("iframe[data-lib]") ?? [];
      const frame = Array.from(frames).find((f) => f.contentWindow === e.source);
      if (!frame) return;
      if (typeof e.data.lsGo === "string") go(e.data.lsGo);
      if (e.data.lsSolo && typeof e.data.h === "number") frame.style.height = `${Math.max(60, Math.min(4000, e.data.h))}px`;
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [navigate]);

  const activate = (target: EventTarget | null) => {
    const el = (target as HTMLElement | null)?.closest?.(CLICKABLE) as HTMLElement | null;
    if (!el) return;
    if (el.matches(".nav .lg")) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const text = el.textContent || "";
    const route = routeForText(text) ?? (el.matches(".foot span") ? null : "/onboarding");
    if (!route) return;
    if (route === "/onboarding") trackAll("cta");
    navigate(route);
  };

  if (state === "failed") return <Landing5 />;
  return (
    <>
      {state === "loading" && <PageLoading />}
      <div
        ref={ref}
        className="lsk"
        style={{ minHeight: "100vh", background: "#070809", display: state === "ok" ? "block" : "none" }}
        onClick={(e) => activate(e.target)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { if ((e.target as HTMLElement).matches?.(CLICKABLE)) { e.preventDefault(); activate(e.target); } } }}
      />
    </>
  );
}
