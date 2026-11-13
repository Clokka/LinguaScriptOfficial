// /english/exams — which English exam do I need? (study abroad + beginner certificates)
// Score ranges are typical, never guarantees: every page says "check your university".
import { Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { MarketingLayout, H2 } from "@/components/marketing/MarketingLayout";
import { A1Nav } from "./A1Shared";
import { Bibliography } from "./A1Sources";

const STUDY = [
  { name: "IELTS Academic", by: "British Council, IDP, Cambridge", score: "Bands 0–9", ask: "often 6.0–7.0", how: "Test centre (paper or computer)", best: "UK, Australia, Canada, New Zealand, Europe" },
  { name: "TOEFL iBT", by: "ETS", score: "0–120", ask: "often 80–100", how: "Test centre or at home", best: "USA and worldwide" },
  { name: "PTE Academic", by: "Pearson", score: "10–90", ask: "often 58–65+", how: "Computer at a test centre", best: "Australia, UK, worldwide" },
  { name: "Duolingo English Test", by: "Duolingo", score: "10–160", ask: "often 105–120", how: "Online at home, about 1 hour", best: "Many US and international universities" },
  { name: "Cambridge B2 First / C1 Advanced", by: "Cambridge", score: "Cambridge English Scale", ask: "often C1 Advanced", how: "Test centre", best: "UK and European universities" },
];

const BEGINNER = [
  { name: "Trinity GESE (early grades)", what: "A short speaking exam with an examiner, from beginner level.", for: "Children and adults who want a first speaking certificate" },
  { name: "LanguageCert ESOL (A1)", what: "Listening, reading, writing and speaking at A1.", for: "Adults who need an A1 certificate (e.g. some visa or work routes)" },
  { name: "Pearson English International Certificate (A1)", what: "A general English exam available at A1.", for: "Teens and adults" },
  { name: "Cambridge A1 Movers", what: "A fun exam for young learners.", for: "Children (about 7–12)" },
];

export default function EnglishExams() {
  return (
    <>
      <Seo title="Which English exam do you need? IELTS, TOEFL, PTE, Duolingo and A1 certificates"
        description="Planning to study abroad? Compare IELTS, TOEFL iBT, PTE Academic, the Duolingo English Test and Cambridge exams, plus the best first certificates at A1."
        path="/english/exams" />
      <MarketingLayout eyebrow="English · exams & study abroad" heading="Which English exam do you need?"
        intro={<>LinguaScript helps you <strong className="text-foreground">learn</strong> the English; an official exam <strong className="text-foreground">proves</strong> it. Here's which exam fits your goal, from your first A1 certificate to the score a university asks for.</>}
        cta={{ label: "Start with A1, free", to: "/english/a1" }}>
        <A1Nav />

        <H2>To study abroad (university)</H2>
        <p>Most universities ask for <strong className="text-foreground">B2 or C1</strong>. That's about 1–2 years of steady study after A1. Scores below are typical requests, not rules. <strong className="text-foreground">Always check your university's own page.</strong></p>
        <div className="not-prose overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-muted/50 text-foreground"><tr><th className="p-3">Exam</th><th className="p-3">Score</th><th className="p-3">Universities often ask</th><th className="p-3">How you take it</th><th className="p-3">Popular for</th></tr></thead>
            <tbody>
              {STUDY.map((e) => (
                <tr key={e.name} className="border-t border-border align-top">
                  <td className="p-3"><span className="font-bold text-foreground">{e.name}</span><span className="block text-xs text-muted-foreground">{e.by}</span></td>
                  <td className="p-3">{e.score}</td><td className="p-3">{e.ask}</td><td className="p-3">{e.how}</td><td className="p-3">{e.best}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm"><strong className="text-foreground">TOEIC</strong> (ETS) is mainly for <strong className="text-foreground">work</strong>: companies use it to check English at work. It's rarely used for university places.</p>

        <H2>Your first certificate (A1)</H2>
        <p>Want proof of your first level? These exams have A1 options:</p>
        <ul className="not-prose grid gap-3 sm:grid-cols-2">
          {BEGINNER.map((b) => (
            <li key={b.name} className="rounded-2xl border border-border bg-card p-4">
              <p className="font-bold text-foreground">{b.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{b.what}</p>
              <p className="mt-2 text-xs text-muted-foreground">Good for: {b.for}</p>
            </li>
          ))}
        </ul>

        <H2>Your path to studying abroad</H2>
        <ol className="list-decimal space-y-2 pl-6">
          <li><strong className="text-foreground">A1:</strong> the <Link to="/english/a1" className="text-primary hover:underline">free A1 guide</Link>: grammar, your first A1 words (about 400–700 in total) and a practice test.</li>
          <li><strong className="text-foreground">A2–B1:</strong> watch real English videos in LinguaScript; your known words turn green as you go.</li>
          <li><strong className="text-foreground">B2–C1:</strong> practise for the exam your university asks for, then book it.</li>
        </ol>

        <H2>Sources</H2>
        <Bibliography />
      </MarketingLayout>
    </>
  );
}
