import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { COVERAGE } from "@/lib/coverage";
import { ZIPF_WORDS_FOR } from "@/lib/speedRun";

/**
 * Why LinguaScript teaches the most frequent words first (Zipf's law), with
 * the coverage table. "Words needed" comes from Zipf's law fitted to the
 * Oxford English Corpus (top 100 words = 50%); it reproduces the corpus's own
 * measurements (top 10 ≈ 25%, 7,000 ≈ 90%). Films / TV figures are measured
 * (Webb & Rodgers 2009, Nation 2006). Keep the sources list below in sync.
 * The 10–50% word counts live in src/lib/speedRun.ts (Speed Run uses them too).
 */
const ROWS: { pct: number; words: string; note: string }[] = [
  { pct: 10, words: String(ZIPF_WORDS_FOR[10]), note: "“the” and “be” — about 1 word in every 10 you hear or read" },
  { pct: 20, words: String(ZIPF_WORDS_FOR[20]), note: "the, be, to, of" },
  { pct: 30, words: String(ZIPF_WORDS_FOR[30]), note: "the top 10 words alone are ~25% of English (measured)" },
  { pct: 40, words: String(ZIPF_WORDS_FOR[40]), note: "little words that glue every sentence together" },
  { pct: 50, words: String(ZIPF_WORDS_FOR[50]), note: "measured: the top 100 words are half of all English" },
  { pct: 60, words: "~300", note: "everyday verbs and nouns arrive: go, know, time, people" },
  { pct: 70, words: "~800", note: "simple conversations start to make sense" },
  { pct: 80, words: "~1,000–2,300", note: "~1,000 word families in films & TV; ~2,300 words in written text" },
  { pct: 90, words: "~2,000–7,000", note: "~2,000 families in speech; 7,000 words in written text (measured)" },
  { pct: 95, words: "~3,000", note: "measured: films and TV, plus names (Webb & Rodgers)" },
  { pct: 98, words: "~6,000–7,000", note: "measured: films, TV and conversation — comfortable understanding" },
  { pct: 100, words: "never", note: "names, slang and rare words go on forever — and that's fine" },
];

const SOURCES = [
  { label: "Nation (2006) — How large a vocabulary is needed for reading and listening?", href: "https://doi.org/10.3138/cmlr.63.1.59" },
  { label: "Webb & Rodgers (2009) — The lexical coverage of movies", href: "https://doi.org/10.1093/applin/amp010" },
  { label: "Webb & Rodgers (2009) — Vocabulary demands of television programs", href: "https://doi.org/10.1111/j.1467-9922.2009.00509.x" },
  { label: "Oxford English Corpus — top 10 words ≈ 25%, top 100 ≈ 50%, 7,000 ≈ 90%", href: "https://en.wikipedia.org/wiki/Most_common_words_in_English" },
  { label: "Schmitt & Adolphs (2003) — Lexical coverage of spoken discourse", href: "https://doi.org/10.1093/applin/24.4.425" },
];

export default function FrequentWords() {
  return (
    <>
      <Seo
        title="Learn the most frequent words first — Zipf's law and LinguaScript"
        description="100 words make up half of everything you hear. 3,000 cover 95% of films and TV. See the coverage table for 10% to 100% and how LinguaScript teaches the most frequent words first."
        path="/frequent-words"
      />
      <MarketingLayout
        eyebrow="Frequent words"
        heading="100 words are half of everything you'll ever hear"
        intro={
          <>
            Languages are lopsided. A tiny group of words does almost all the work — this is
            <strong className="text-foreground"> Zipf's law</strong>. Learn those words first and
            real films, shows and conversations open up months sooner. That's why LinguaScript
            always teaches the most frequent words first.
          </>
        }
        cta={{ label: "Start with your first 100 words", to: "/auth" }}
      >
        <H2>Zipf's law in one sentence</H2>
        <p>
          The 2nd most common word appears about half as often as the 1st, the 3rd about a third
          as often, the 10th a tenth as often… So a few words are everywhere, and thousands of
          words are rare.
        </p>

        <H2>How many words do you need?</H2>
        <div className="not-prose overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-foreground">
              <tr>
                <th className="p-3">You understand</th>
                <th className="p-3">Words to learn</th>
                <th className="hidden p-3 sm:table-cell">What that looks like</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.pct} className="border-t border-border align-top">
                  <td className="p-3">
                    <div className="font-bold text-foreground">{r.pct}%</div>
                    <div className="mt-1 h-1.5 w-full max-w-[110px] rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${r.pct}%`, background: r.pct >= COVERAGE.MIN ? "#34C759" : r.pct >= 70 ? "#FF8A00" : "#FF3B30" }}
                      />
                    </div>
                  </td>
                  <td className="p-3 font-semibold text-foreground">{r.words}</td>
                  <td className="hidden p-3 text-muted-foreground sm:table-cell">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          Up to 50% and the written figures: Zipf's law fitted to the 2-billion-word Oxford English
          Corpus, which matches its own counts (top 10 ≈ 25%, top 100 ≈ 50%, 7,000 ≈ 90%). From 80%
          up, the films/TV numbers are measured in real scripts and count word families (“play,
          plays, played” = one) plus names. Speech is more repetitive than writing, so you need fewer
          words for films and conversation than for books. Numbers are for English; most languages
          follow the same curve.
        </p>

        <H2>The magic numbers: {COVERAGE.STRETCH}%, {COVERAGE.MIN}% and {COVERAGE.IDEAL}%</H2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong>{COVERAGE.IDEAL}%</strong> — 1 unknown word in 50. You follow easily and pick up new words from context. Ideal.</li>
          <li><strong>{COVERAGE.MIN}%</strong> — 1 in 20. You follow the story; new words stand out clearly. Good.</li>
          <li><strong>{COVERAGE.STRETCH}%</strong> — 1 in 10. Hard work. A stretch.</li>
        </ul>
        <p>
          LinguaScript measures this for every video against <em>your</em> words, and recommends
          videos you'll understand at {COVERAGE.MIN}% or more.
        </p>

        <p>
          Want to start now? The <Link to="/speed-run" className="text-primary underline">Speed Run</Link> teaches
          these words in order: 2 words, then 4, 13, 36 and 100.
        </p>

        <H2>How LinguaScript teaches you the frequent words</H2>
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            <strong>Watch films and shows you love</strong> with{" "}
            <Link to="/dual-subtitles" className="text-primary underline">dual subtitles</Link>. Every
            word is coloured by how well you know it — the most frequent ones turn green first.
          </li>
          <li>
            <strong>Tap a red word to save it.</strong> It becomes a flashcard: red → orange → green.
            When a green word is due for review it glows <strong style={{ color: "#B07A00" }}>gold</strong>.
          </li>
          <li>
            <strong>Switch your phone to your target language.</strong> Settings → System → Language
            → add Japanese (or Spanish, French…) and move it to the top. The words you see 100 times
            a day — Settings, Send, Search, Delete — are exactly the high-frequency words.
          </li>
          <li>
            <strong>Save words from anywhere.</strong> Highlight text in any app →{" "}
            <em>Save to LinguaScript</em>, or tap a word on YouTube with the{" "}
            <Link to="/overlay" className="text-primary underline">🦎 overlay</Link>.
          </li>
          <li>
            <strong>Practise with your AI.</strong> Connect LinguaScript to{" "}
            <Link to="/ai" className="text-primary underline">ChatGPT or Claude</Link> and ask it to
            teach you the next most frequent words you don't know yet.
          </li>
        </ol>

        <H2>Sources</H2>
        <ul className="list-disc space-y-1 pl-6 text-sm">
          {SOURCES.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noopener noreferrer" className="text-primary underline">{s.label}</a>
            </li>
          ))}
        </ul>
      </MarketingLayout>
    </>
  );
}
