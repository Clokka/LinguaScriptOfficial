// The Site Studio (public/brand/site-studio.html) inside HQ, connected:
// its "Go live", "Save for the team" and "Start this test live" buttons post
// a message here; we check the sender, show the "Are you sure?" dialog and
// publish. Team drafts are sent back so everyone can open them.
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { DEFAULT_FILM_LOADER, describeLoader, describePage, isFilmDesign, isFilmReveal, isLoaderId, cleanConfig, type SiteConfig, type SitePage } from "@/lib/site/config";
import { PublishDialog, useSite, type Pending } from "@/components/hq/useSite";

export default function StudioFrame({ tab = "gallery", site }: { tab?: string; site?: ReturnType<typeof useSite> }) {
  const own = useSite();
  const s = site ?? own;
  const frame = useRef<HTMLIFrameElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const sendDrafts = (kind: "hello" | "drafts") =>
    frame.current?.contentWindow?.postMessage({ lsHQ: kind, drafts: s.drafts.map((d) => ({ name: d.name, config: d.config })) }, window.location.origin);

  useEffect(() => { sendDrafts("drafts"); }, [s.drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d.lsHQ !== "string") return;
      if (d.lsHQ === "ready") { sendDrafts("hello"); frame.current?.contentWindow?.postMessage({ lsHQ: "tab", tab }, window.location.origin); }
      if (d.lsHQ === "saveDraft" && typeof d.name === "string" && d.config) {
        const ok = await s.saveDraft(d.name, d.config, d.quiet === true);
        if (ok && !d.quiet) frame.current?.contentWindow?.postMessage({ lsHQ: "done", text: "Saved for the team ☁️" }, window.location.origin);
      }
      if (d.lsHQ === "publish" && d.page) {
        const next: SiteConfig = { ...s.base(), home: { mode: "single", page: d.page as SitePage } };
        if (!cleanConfig(next)) return;
        const lines = [`Homepage → ${describePage(d.page)}`];
        if (isLoaderId(d.loader) && d.loader !== "none") {
          next.intro = { ...(next.intro ?? { when: "session", end: "auto" }), loader: d.loader } as SiteConfig["intro"];
          lines.push(`Intro loading screen → ${describeLoader(d.loader)} (change or switch off in Go live)`);
        }
        setPending({ title: "Make this the homepage?", lines, config: next, note: d.name ?? "" });
      }
      if (d.lsHQ === "filmLoader" && (isFilmDesign(d.id) || isFilmReveal(d.id))) {
        const base = s.base();
        const f = base.filmLoader ?? DEFAULT_FILM_LOADER;
        const key = isFilmReveal(d.id) ? "reveals" : "designs";
        if (f[key].includes(d.id)) { frame.current?.contentWindow?.postMessage({ lsHQ: "done", text: "Already in the video loading rotation" }, window.location.origin); return; }
        const next: SiteConfig = { ...base, filmLoader: { ...f, [key]: [...f[key], d.id] } };
        setPending({
          title: "Add this to the video loading screens?",
          lines: [key === "reveals" ? `Plays when a video's subtitles are ready (${f.reveals.length + 1} in rotation)` : `Shows while videos load (${f.designs.length + 1} in rotation)`,
            "Remove or reorder any time in Go live → Video loading screens."],
          config: next,
        });
      }
      if (d.lsHQ === "publishTest" && Array.isArray(d.arms)) {
        const stamp = new Date().toISOString().slice(0, 16).replace(/\D/g, "");
        const next: SiteConfig = { ...s.base(), home: { mode: "test", key: `landing_hq_${stamp}`, arms: d.arms.slice(0, 4) } };
        if (!cleanConfig(next)) return;
        setPending({
          title: `Start a ${d.arms.length}-way homepage test?`,
          lines: d.arms.map((a: { id: string; name: string; page: SitePage }) => `${a.id.toUpperCase()} · ${a.name} (${describePage(a.page)})`)
            .concat("Each visitor always sees the same version; results show in HQ → Results."),
          config: next,
        });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }); // re-bind each render so the handler sees fresh drafts/live

  return (
    <div className="space-y-2">
      <a href={`/brand/site-studio.html#${tab}`} target="_blank" rel="noopener"
        className="inline-flex items-center gap-1 text-sm underline text-muted-foreground hover:text-foreground">
        Open full screen (view only — publish from here) <ExternalLink className="h-3.5 w-3.5" />
      </a>
      <iframe ref={frame} src={`/brand/site-studio.html#${tab}`} title="Site Studio"
        className="w-full rounded-2xl border border-white/10 bg-black" style={{ height: "calc(100vh - 170px)", minHeight: 620 }} />
      <PublishDialog pending={pending} onClose={() => setPending(null)} publish={s.publish} />
    </div>
  );
}
