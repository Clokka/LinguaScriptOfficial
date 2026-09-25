/**
 * "You know 412 of the 1,000 most common French words."
 *
 * The single most motivating honest number we can show: coverage of the
 * frequency list, band by band, rather than a raw saved-word total that says
 * nothing about how much real speech those words unlock.
 */
import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { LANGUAGES } from "@/lib/languages";
import {
  loadFrequencyCoverage,
  headlineBand,
  type CoverageBand,
} from "@/lib/frequencyCoverage";

interface Props {
  language: string;
}

export function FrequencyCoverageCard({ language }: Props) {
  const [bands, setBands] = useState<CoverageBand[]>([]);

  useEffect(() => {
    let alive = true;
    loadFrequencyCoverage(language).then((b) => {
      if (alive) setBands(b);
    });
    return () => {
      alive = false;
    };
  }, [language]);

  const headline = headlineBand(bands);
  if (!headline || headline.total === 0) return null;

  const languageName =
    LANGUAGES.find((l) => l.code === language)?.label ?? language.toUpperCase();
  const pct = Math.min(100, Math.round((headline.known / headline.total) * 100));

  return (
    <section className="glass-panel rounded-2xl p-6">
      <p className="text-xs uppercase tracking-wider text-muted-foreground/70">
        Most common words
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">
        You know{" "}
        <span className="tabular-nums text-[#34C759]">
          {headline.known.toLocaleString()}
        </span>{" "}
        of the {headline.band.toLocaleString()} most common {languageName} words
      </p>
      <Progress value={pct} className="mt-4 h-2" />
      <p className="mt-2 text-sm text-muted-foreground">
        These are the words that appear most often in real speech — learning
        them in order is the fastest route to understanding what you watch.
      </p>
    </section>
  );
}
