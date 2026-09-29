/**
 * "You know 412 of the 1,000 most common French words."
 *
 * The single most motivating honest number we can show: coverage of the
 * frequency list, band by band, rather than a raw saved-word total that says
 * nothing about how much real speech those words unlock.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  const complete = headline.band >= 3000 && headline.known >= headline.total;
  const next = Math.min(3000, headline.band + 50);

  return (
    <section className="rounded-2xl border border-[#34C759]/40 bg-[#34C759]/10 p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#34C759]">
        Most common words
      </p>
      {complete ? (
        <p className="mt-1 text-2xl font-bold text-foreground">
          <span className="text-[#34C759]">{languageName} complete!</span> You know the
          3,000 most common words.
        </p>
      ) : (
        <p className="mt-1 text-2xl font-bold text-foreground">
          You know{" "}
          <span className="tabular-nums text-[#34C759]">{headline.known.toLocaleString()}</span> of the{" "}
          {headline.band.toLocaleString()} most common {languageName} words
        </p>
      )}
      <p className="mt-1 text-sm tabular-nums text-muted-foreground">
        {complete
          ? "3,000 / 3,000 — language complete"
          : `${pct}% · next milestone: top ${next.toLocaleString()} · goal: top 3,000`}
      </p>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-foreground/10">
        <div className="h-full rounded-full bg-[#34C759]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Learn the top 50, then 100, 150, 200… in steps of 50. Reach the top 3,000
        and you've completed the language.
      </p>
      {!complete && (
        <Link
          to="/flashcards/common"
          className="mt-4 inline-flex items-center rounded-full bg-[#34C759] px-4 py-2 text-sm font-semibold text-background"
        >
          Study these words →
        </Link>
      )}
    </section>
  );
}
