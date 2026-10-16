import { useEffect, useState } from "react";
import { getVariant, track } from "@/lib/experiments";
import { DECK } from "@/lib/deck-colors";

const KEY = "landing_headline";
// Paused while the whole-page `landing_page` test runs: two tests on one
// page would mix up the results. Everyone sees the control line for now.
const VARIANTS = ["control"];

const COPY: Record<string, { line: string; accent: string }> = {
  control: { line: "Learn a language by watching", accent: "what you already love." },
  anime: { line: "Learn Japanese from the anime", accent: "you already watch." },
  exam: { line: "Ace your language exam with", accent: "videos you actually enjoy." },
};

/** A/B tested hero sub-headline on the main landing page. */
export const HeadlineTest = () => {
  const [variant] = useState(() => getVariant(KEY, VARIANTS));
  useEffect(() => { void track(KEY, "view"); }, []);
  const c = COPY[variant] ?? COPY.control;
  return (
    <p className="mt-8 text-xl sm:text-2xl font-semibold tracking-tight text-white/80">
      {c.line} <span style={{ color: DECK.green }}>{c.accent}</span>
    </p>
  );
};

export const trackHeadlineCta = () => void track(KEY, "cta");
