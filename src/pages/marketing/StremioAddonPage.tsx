import { useState } from "react";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES } from "@/lib/languages";

const ADDON_BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stremio-addon`;

const isSupported = (code: string | undefined) => !!code && LANGUAGES.some((l) => l.code === code);

/** Install page for the Stremio dual-subtitle addon (also its /configure page). */
export function StremioAddonPage() {
  const { languageContext } = useLanguage();
  const browserLang = typeof navigator !== "undefined" ? navigator.language.slice(0, 2) : "en";
  const [learn, setLearn] = useState(isSupported(languageContext) ? languageContext : "es");
  const [native, setNative] = useState(isSupported(browserLang) && browserLang !== learn ? browserLang : "en");
  const [copied, setCopied] = useState(false);

  const same = learn === native;
  const manifestUrl = `${ADDON_BASE}/${learn}-${native}/manifest.json`;
  const stremioUrl = manifestUrl.replace(/^https?:\/\//, "stremio://");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(manifestUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the link is visible to copy by hand */
    }
  };

  const select = (value: string, onChange: (v: string) => void, label: string) => (
    <label className="flex flex-1 flex-col gap-2 text-sm font-semibold text-foreground">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-border bg-background px-3 py-2 text-base font-normal"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <>
      <Seo
        title="Stremio dual subtitles addon"
        description="Free LinguaScript addon for Stremio: watch any movie or show with subtitles in the language you're learning on top and your own language underneath."
        path="/stremio"
      />
      <MarketingLayout
        eyebrow="Stremio addon"
        heading="Dual subtitles in Stremio"
        intro={
          <>
            Stremio only shows one subtitle at a time. The LinguaScript addon puts two lines in
            every subtitle: the language you're learning on top, your own language underneath.
          </>
        }
      >
        <div className="space-y-5 rounded-2xl border border-border/60 bg-secondary/30 p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            {select(learn, setLearn, "I'm learning")}
            {select(native, setNative, "I speak")}
          </div>
          {same ? (
            <p className="text-sm text-destructive">Pick two different languages.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <a href={stremioUrl}>Install in Stremio</a>
                </Button>
                <Button size="lg" variant="outline" onClick={copy}>
                  {copied ? "Copied!" : "Copy addon link"}
                </Button>
              </div>
              <p className="break-all font-mono text-xs" translate="no">{manifestUrl}</p>
            </>
          )}
        </div>

        <H2>How to use it</H2>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Pick your languages above and press <strong className="text-foreground">Install in Stremio</strong>.</li>
          <li>
            No Stremio app on this device? Copy the link, open Stremio → Addons, paste it in the
            search box and press Install.
          </li>
          <li>
            Play a movie or episode, open the subtitles menu and choose the one named{" "}
            <strong className="text-foreground">LinguaScript</strong>.
          </li>
          <li>The first time, translating a whole film can take up to a minute. After that it's instant.</li>
        </ol>
      </MarketingLayout>
    </>
  );
}

export default StremioAddonPage;
