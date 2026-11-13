// /english/a1/sources — how the guide was built + bibliography.
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { SOURCES, SOURCE_GROUPS } from "@/lib/english/sources";
import { A1Nav } from "./A1Shared";

export function Bibliography() {
  return (
    <>
      {SOURCE_GROUPS.map((g) => (
        <div key={g}>
          <h3 className="mb-2 mt-6 text-base font-bold text-foreground">{g}</h3>
          <ul className="list-disc space-y-2 pl-6 text-sm">
            {SOURCES.filter((s) => s.group === g).map((s) => (
              <li key={s.cite}>
                {s.cite}{" "}
                {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-primary hover:underline">{s.url.replace(/^https?:\/\//, "")}</a>}
                {s.note && <span className="block text-muted-foreground">{s.note}</span>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

export default function A1Sources() {
  return (
    <>
      <Seo title="How we built the English A1 guide: method and sources"
        description="The English A1 guide follows the Council of Europe's CEFR A1 level. Explanations, examples and tests are written by LinguaScript. Full bibliography."
        path="/english/a1/sources" />
      <MarketingLayout eyebrow="English A1 · sources" heading="How we built this guide" cta={null}>
        <A1Nav />
        <H2>Our method</H2>
        <ul className="list-disc space-y-2 pl-6">
          <li><strong className="text-foreground">Which topics:</strong> the grammar and skills follow the A1 level of the CEFR (Council of Europe). The list of topics is the same in every A1 course, because it comes from the CEFR.</li>
          <li><strong className="text-foreground">Our own words:</strong> every explanation, example sentence, common mistake and test question here is written by LinguaScript.</li>
          <li><strong className="text-foreground">How many words is A1?</strong> The CEFR has <strong className="text-foreground">no official word count</strong>: it describes what you can do, not how many words you know. Courses and exams usually expect <strong className="text-foreground">about 400–700 words</strong> at A1. Research that tests which words learners recognise can find higher numbers (Milton, 2010), so treat any single number as a guide. Our "A1 ready %" uses 700.</li>
          <li><strong className="text-foreground">Most useful first:</strong> words are ordered by how often they're used (word frequency), so you learn the words you'll meet most.</li>
          <li><strong className="text-foreground">Honest about level:</strong> our practice test helps you learn. It is not an official exam. For an official certificate, see <Link to="/english/exams" className="text-primary hover:underline">exams and study abroad</Link>.</li>
        </ul>
        <H2>Bibliography</H2>
        <Bibliography />
      </MarketingLayout>
    </>
  );
}
