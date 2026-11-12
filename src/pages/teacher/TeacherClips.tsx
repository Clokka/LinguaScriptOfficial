// /teacher/clips — every clip lesson, with who watched it, "Add to a lesson"
// (Google Calendar) and remove.
import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTeacher, type Clip } from "@/lib/classroom/teacherData";
import { lessonTemplateUrl } from "@/lib/classroom/calendar";
import { ClipCard, EmptyCard, Icon, PageHeader, PrivacyLine, StatusPill, cardCls, primaryBtn } from "./ui";
import { downloadClipCsv } from "./csv";

export default function TeacherClips() {
  const { clips, groups, reload } = useTeacher();
  const { toast } = useToast();
  const [group, setGroup] = useState<string>("all");
  const [open, setOpen] = useState<string | null>(null);
  const list = clips.filter((c) => group === "all" || c.school_id === group);

  const remove = async (c: Clip) => {
    if (!window.confirm(`Remove "${c.title}" from ${c.group}? You'll stop seeing anyone's progress on it.`)) return;
    const { error } = await supabase.rpc("delete_class_assignment", { _assignment_id: c.id });
    if (error) { toast({ title: "Couldn't remove it", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Clip removed", description: "Your students no longer see it, and you no longer see their progress on it." });
    await reload();
  };

  return (
    <>
      <PageHeader title="Clip lessons" sub="Short videos your students watch at home. Everyone uses the same LinguaScript player."
        actions={<Link to="/teacher/clips/new" className={primaryBtn}><Icon.plus />New clip lesson</Link>} />

      {groups.length > 1 && (
        <div role="tablist" aria-label="Group" className="flex flex-wrap gap-2">
          {[{ school_id: "all", name: "All groups" }, ...groups].map((g) => (
            <button key={g.school_id} type="button" role="tab" aria-selected={group === g.school_id} onClick={() => setGroup(g.school_id)}
              className={`h-10 rounded-full px-4 text-sm font-semibold ${group === g.school_id ? "bg-[#F2F2F5] text-[#0B0B0D]" : "border border-[#2A2A30] text-[#A1A1AA] hover:text-[#F2F2F5]"}`}>
              {g.name}
            </button>
          ))}
        </div>
      )}

      {list.length === 0 && (
        <EmptyCard title="No clip lessons yet" action={<Link to="/teacher/clips/new" className={primaryBtn}><Icon.plus />New clip lesson</Link>}>
          Short clips work best: 1–3 minutes your students can watch twice until the words turn green.
        </EmptyCard>
      )}

      <div className="flex flex-col gap-3.5">
        {list.map((c, i) => (
          <div key={c.id} className="flex flex-col gap-2">
            <ClipCard clip={c} index={i} right={
              <div className="flex flex-wrap gap-2 md:flex-col">
                <button type="button" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}
                  className="h-10 rounded-xl border border-[#2A2A30] bg-[#17171B] px-3.5 text-sm font-semibold hover:bg-[#1F1F25]">
                  {open === c.id ? "Hide students" : "Students"}
                </button>
                <a href={lessonTemplateUrl({ clipTitle: c.title, group: c.group, filmId: c.film_id })} target="_blank" rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#2A2A30] bg-[#17171B] px-3.5 text-sm font-semibold hover:bg-[#1F1F25]">
                  Add to a lesson
                </a>
                <button type="button" aria-label={`Remove ${c.title}`} onClick={() => void remove(c)}
                  className="inline-flex h-10 items-center justify-center rounded-xl px-3 text-[#A1A1AA] hover:bg-[#1F1F25] hover:text-[#FF5A4F]">
                  <Icon.trash />
                </button>
              </div>
            } />
            {open === c.id && (
              <div className={`${cardCls} flex flex-col gap-3 p-4`}>
                {c.note && <p className="m-0 text-sm text-[#D4D4D8]"><b>Note for students:</b> {c.note}</p>}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-[#8E8E98]">
                      <th className="py-2 pr-3 font-semibold">Student</th><th className="py-2 pr-3 font-semibold">Watched</th>
                      <th className="py-2 pr-3 font-semibold">Watches</th><th className="py-2 pr-3 font-semibold">Words green</th>
                      <th className="py-2 font-semibold">Status</th>
                    </tr></thead>
                    <tbody>
                      {c.students.map((s) => (
                        <tr key={s.user_id} className="border-t border-[#1E1E23]">
                          <td className="py-2.5 pr-3 font-semibold">{s.name}</td>
                          <td className="py-2.5 pr-3 text-[#D4D4D8]">{s.watched_pct == null ? "0%" : `${Math.round(s.watched_pct)}%`}</td>
                          <td className="py-2.5 pr-3 text-[#D4D4D8]">{s.watch_count ?? 0}</td>
                          <td className="py-2.5 pr-3 text-[#D4D4D8]">{s.green_pct == null ? "–" : `${Math.round(s.green_pct)}%`}</td>
                          <td className="py-2.5"><StatusPill status={s.status} /></td>
                        </tr>
                      ))}
                      {c.students.length === 0 && <tr><td colSpan={5} className="py-4 text-[#A1A1AA]">No students in this group yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
                {c.students.length > 0 && <button type="button" className="self-start text-sm font-semibold text-[#34C759]" onClick={() => downloadClipCsv(c)}>Download for Google Sheets</button>}
                <p className="m-0 text-xs text-[#8E8E98]">"Watched" is how far into the video they got (finished = 90%+). "Words green" is how much of its language they know; it rises with each rewatch. Practice records, not grades.</p>
              </div>
            )}
          </div>
        ))}
      </div>
      <PrivacyLine />
    </>
  );
}
