import { ArrowLeft, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ASSET_CREDITS } from "@/lib/credits";

const CATEGORY_LABELS: Record<string, string> = {
  pet: "Pet models",
  gift: "Gift scene",
  accessory: "Pet accessories",
};

export default function Credits() {
  const navigate = useNavigate();
  const grouped = ASSET_CREDITS.reduce<Record<string, typeof ASSET_CREDITS>>((acc, c) => {
    (acc[c.category] ??= []).push(c);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 max-w-2xl mx-auto px-6 py-12">
        <Button variant="glass" onClick={() => navigate(-1)} className="mb-8 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-2">Credits</h1>
        <p className="text-muted-foreground mb-8 text-sm">
          LinguaScript uses these Creative Commons-licensed 3D models. Thanks to
          every creator who shared their work.
        </p>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-3">Word lists</h2>
          <p className="text-sm text-muted-foreground">
            Instant word meanings use the most common words from{" "}
            <a className="underline" href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener noreferrer">FrequencyWords</a>{" "}
            by Hermit Dave (OpenSubtitles 2018), licensed{" "}
            <a className="underline" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.
            Our word pack built from it (<a className="underline" href="/dict/fr-en.v1.json">fr-en.v1.json</a>) is shared under the same licence.
          </p>
        </section>

        <div className="space-y-8">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category}>
              <h2 className="text-lg font-semibold text-foreground mb-3">
                {CATEGORY_LABELS[category] ?? category}
              </h2>
              <ul className="space-y-2">
                {items.map((item) => (
                  <li
                    key={`${item.title}-${item.author}`}
                    className="glass-panel px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-foreground font-medium truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {item.author} · {item.license}
                      </p>
                    </div>
                    <a
                      href={item.source}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:text-primary/80 inline-flex items-center gap-1 shrink-0"
                    >
                      Source <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
