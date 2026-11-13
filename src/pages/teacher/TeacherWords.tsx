// /teacher/words — how green each live clip is for the class (real data from
// class_assignment_progress). Per-word colours and tricky words arrive with
// the 5-question clip check (docs/plans/efl-teacher-tool.md, Phase 2).
import { Link } from "react-router-dom";
import { useTeacher } from "@/lib/classroom/teacherData";
import { EmptyCard, PageHeader, PrivacyLine, SectionTitle, cardCls, primaryBtn } from "./ui";

const STATES = [
  ["New", "#FF5A4F", "Never met, or just saved"], ["Learning", "#FF9F0A", "Seen a few times"],
  ["Known", "#34C759", "Understood in the clip"], ["Review due", "#FFD60A", "Known, time for a quick check"],
  ["100% known", "#6C8CF2", "Passed the 30-day review"],
] as const;

export default function TeacherWords() {
  const { clips } = useTeacher();
  const live = clips.filter((c) => c.live);
  return (
    <>
      <PageHeader title="Class words" sub="Every word in LinguaScript has a colour that shows how well it's known." />
      <section className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
        {STATES.map(([label, color, hint]) => (
          <div key={label} className={`${cardCls} flex flex-col gap-1.5 p-4`}>
            <span className="flex items-center gap-2 text-sm font-bold"><i className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>
            <span className="text-[13px] text-[#A1A1AA]">{hint}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="green-h" className="flex flex-col gap-3.5">
        <SectionTitle id="green-h">How green each clip is</SectionTitle>
        {live.length === 0 && <EmptyCard title="No clips live" action={<Link to="/teacher/clips/new" className={primaryBtn}>New clip lesson</Link>}>Set a clip and you'll see how much of its language the class understands.</EmptyCard>}
        {live.map((c) => (
          <div key={c.id} className={`${cardCls} flex flex-col gap-3 p-5`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-base font-bold">{c.title} <span className="ml-1 text-xs font-semibold text-[#A1A1AA]">{c.group}</span></span>
              <span className="text-sm text-[#A1A1AA]">Class average <b className="text-[#34C759]">{c.avgGreen == null ? "–" : `${c.avgGreen}%`}</b></span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#232329]"><div className="h-3 rounded-full bg-[#34C759]" style={{ width: `${c.avgGreen ?? 0}%` }} /></div>
          </div>
        ))}
      </section>

      <EmptyCard title="Coming next: tricky words">
        After each clip, students will take a 5-question check. Words most of the class misses will show here and on Today, ringed in orange, so you can teach them in 5 minutes.
      </EmptyCard>
      <PrivacyLine />
    </>
  );
}
