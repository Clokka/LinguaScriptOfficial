// HQ → 🎬 Animations: the Site Studio's loading-screen workspaces only
// (LinguaScript name intro · Before a film · Streaming startup), opened with
// ?animations=1 so the page builder is hidden. Landing pages are chosen by
// address on HQ → Today instead. Every message is checked by origin + source,
// then goes through the usual "OK, go live" dialog.
import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_FILM_LOADER, describeLoader, isFilmDesign, isFilmReveal, isLoaderId, type SiteConfig } from "@/lib/site/config";
import { PublishDialog, useSite, type Pending } from "@/components/hq/useSite";

const SRC = "/brand/site-studio.html?animations=1";

export default function AnimationsFrame({ site }: { site: ReturnType<typeof useSite> }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const post = (m: Record<string, unknown>) => frame.current?.contentWindow?.postMessage(m, window.location.origin);
  const sendDrafts = (kind: "hello" | "drafts") => post({ lsHQ: kind, drafts: site.drafts.map((d) => ({ name: d.name, config: d.config })) });

  useEffect(() => { sendDrafts("drafts"); }, [site.drafts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onMsg = async (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frame.current?.contentWindow) return;
      const d = e.data;
      if (!d || typeof d.lsHQ !== "string") return;
      if (d.lsHQ === "ready") sendDrafts("hello");
      if (d.lsHQ === "pageLoader" && (d.id === "skeleton" || d.id === "brand")) {
        setPending({ title: "Change the streaming startup screen?", lines: [`App & page loading → ${d.id === "brand" ? "Chameleon + colour word" : "Grey skeleton"}`], config: { ...site.base(), pageLoader: d.id } });
      }
      if (d.lsHQ === "introLoader" && isLoaderId(d.id)) {
        const base = site.base();
        setPending({ title: "Change the LinguaScript name intro?", lines: [`Intro → ${describeLoader(d.id)}`], config: { ...base, intro: { when: "session", end: "auto", ...base.intro, loader: d.id } } });
      }
      if (d.lsHQ === "filmLoader" && (isFilmDesign(d.id) || isFilmReveal(d.id))) {
        const base = site.base();
        const f = base.filmLoader ?? DEFAULT_FILM_LOADER;
        const key = isFilmReveal(d.id) ? "reveals" : "designs";
        if (f[key].includes(d.id)) { post({ lsHQ: "done", text: "Already in the video loading rotation" }); return; }
        const next: SiteConfig = { ...base, filmLoader: { ...f, [key]: [...f[key], d.id] } };
        setPending({ title: "Add this to the video loading screens?", config: next,
          lines: [key === "reveals" ? `Plays when a video's subtitles are ready (${f.reveals.length + 1} in rotation)` : `Shows while videos load (${f.designs.length + 1} in rotation)`, "Remove any time in HQ → Loading screens."] });
      }
      // ⭐ team stars are kept as a draft row so everyone sees them.
      if (d.lsHQ === "saveDraft" && typeof d.name === "string" && d.config) {
        const ok = await site.saveDraft(d.name, d.config, d.quiet === true);
        if (ok && !d.quiet) post({ lsHQ: "done", text: "Saved for the team ☁️" });
      }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  return (
    <div className="space-y-2">
      <Button variant="link" asChild className="h-auto justify-start p-0 text-muted-foreground">
        <a href={SRC} target="_blank" rel="noopener">Open full screen (look only, go live from here) <ExternalLink className="h-3.5 w-3.5" /></a>
      </Button>
      <iframe ref={frame} src={SRC} title="Animations studio" className="w-full rounded-md border border-border bg-background" style={{ height: "calc(100vh - 170px)", minHeight: 620 }} />
      <PublishDialog pending={pending} onClose={() => setPending(null)} publish={site.publish} />
    </div>
  );
}
