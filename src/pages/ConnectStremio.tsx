import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";

/** The LinguaScript Stremio add-on (supabase/functions/stremio-addon). See docs/MEDIA_COMPATIBILITY.md. */
const ADDON_HOST = "ffephracinqeylfhqkiz.supabase.co/functions/v1/stremio-addon";

const LANGS: Record<string, string> = {
  fr: "French", es: "Spanish", de: "German", it: "Italian", pt: "Portuguese", ja: "Japanese", ko: "Korean",
  zh: "Chinese", ru: "Russian", ar: "Arabic", nl: "Dutch", pl: "Polish", sv: "Swedish", tr: "Turkish",
  hi: "Hindi", th: "Thai", en: "English",
};

function Picker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex-1 space-y-1 text-sm font-semibold">
      <span>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-border bg-background px-3 text-foreground"
      >
        {Object.entries(LANGS).map(([code, name]) => <option key={code} value={code}>{name}</option>)}
      </select>
    </label>
  );
}

export default function ConnectStremio() {
  const [learn, setLearn] = useState("fr");
  const [native, setNative] = useState("en");
  const [copied, setCopied] = useState(false);
  const same = learn === native;
  const manifest = `https://${ADDON_HOST}/${learn}-${native}/manifest.json`;
  const appLink = `stremio://${ADDON_HOST}/${learn}-${native}/manifest.json`;
  const webLink = `https://web.stremio.com/#/addons?addon=${encodeURIComponent(manifest)}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(manifest); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* shown below */ }
  };

  return (
    <>
      <Seo
        title="LinguaScript for Stremio: dual-language subtitles"
        description="Add the LinguaScript add-on to Stremio on Windows, Mac, Linux, Android or TV: subtitles in the language you're learning with your own language underneath."
        path="/stremio"
      />
      <MarketingLayout
        eyebrow="Stremio"
        heading="Learn with films in the Stremio app"
        intro={<>The LinguaScript add-on shows subtitles in the language you're learning with your own language underneath. It works in the Stremio desktop app, on Android and on TV.</>}
        cta={null}
      >
        <div className="not-prose space-y-4 rounded-2xl border border-border bg-card p-5 text-foreground">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Picker label="I'm learning" value={learn} onChange={setLearn} />
            <Picker label="I speak" value={native} onChange={setNative} />
          </div>
          {same && <p className="text-sm text-destructive">Pick two different languages.</p>}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" disabled={same} className="sm:flex-1">
              <a href={same ? undefined : appLink} onClick={() => track("stremio_addon_install_clicked", { learn, native, where: "app" })}>
                <Download className="mr-2 h-4 w-4" /> Install in the Stremio app
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" disabled={same} className="sm:flex-1">
              <a href={same ? undefined : webLink} target="_blank" rel="noopener noreferrer" onClick={() => track("stremio_addon_install_clicked", { learn, native, where: "web" })}>
                Install in Stremio Web
              </a>
            </Button>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2">
            <code className="flex-1 break-all text-xs">{manifest}</code>
            <Button variant="outline" size="sm" onClick={copy} disabled={same}>
              {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <H2>How to use it</H2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Press <strong>Install in the Stremio app</strong>. Nothing happens? Open Stremio → Add-ons, paste the copied link into the search box and press Install.</li>
          <li>Play a film or episode, open the subtitles menu and choose <strong>LinguaScript {LANGS[learn]} + {LANGS[native]}</strong>.</li>
          <li>Hear a word you want to keep? On a computer, use Stremio Web in Chrome with the LinguaScript extension to tap the word and save it to your flashcards.</li>
        </ol>
        <p>Subtitles come from OpenSubtitles, and the second line is a machine translation, so it may not always be perfect. Some films don't have subtitles in every language yet.</p>
      </MarketingLayout>
    </>
  );
}
