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
import { GlassCard, CountUp, ProgressRing, Eyebrow } from "@/components/premium";

interface Props {
  language: string;
  /** Where "Study these words" goes. The deck page itself passes the review
   *  route, since linking to its own URL would do nothing. */
  studyTo?: string;
}

export function FrequencyCoverageCard({ language, studyTo = "/flashcards/common" }: Props) {
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
  const left = Math.max(0, headline.total - headline.known);
  // On the last deck "Next deck: Top 3,000" pointed at the deck you were
  // already in — show how many words are left instead.
  const nextLine = headline.band >= 3000
    ? `${left.toLocaleString()} to go`
    : `Next deck: Top ${(headline.band + 50).toLocaleString()}`;

  return (
    <GlassCard as="section" accent="green" glow className="ls-shine overflow-hidden p-6">
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          <Eyebrow>Most common words</Eyebrow>
          {complete ? (
            <p className="mt-2 text-2xl font-black leading-tight text-foreground">
              <span className="ls-text-gradient">{languageName} complete</span> — you know the
              3,000 most common words.
            </p>
          ) : (
            <p className="mt-2 text-2xl font-black leading-tight tracking-tight text-foreground">
              You know <span className="ls-text-gradient"><CountUp value={headline.known} /></span> of the{" "}
              {headline.band.toLocaleString()} most common {languageName} words
            </p>
          )}
          {!complete && <p className="mt-2 text-sm tabular-nums text-muted-foreground">{nextLine}</p>}
        </div>
        <ProgressRing value={pct / 100} size={76} stroke={7}>
          <span className="text-sm font-bold tabular-nums text-foreground">{pct}%</span>
        </ProgressRing>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">
        These are the words that appear most often in real speech — learning them in
        order is the fastest route to understanding what you watch.
      </p>
      {headline.assumed > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          plus {headline.assumed.toLocaleString()} words assumed from your level
        </p>
      )}
      {!complete && (
        <Link
          to={studyTo}
          className="mt-5 inline-flex items-center rounded-full bg-[#34C759] px-5 py-2.5 text-sm font-bold text-background shadow-[0_10px_30px_-10px_#34C759] transition hover:brightness-110"
        >
          Study these words →
        </Link>
      )}
    </GlassCard>
  );
}
