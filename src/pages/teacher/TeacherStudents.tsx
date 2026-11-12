// /teacher/students — groups, invite links and each student's clip progress.
// /teacher/students#invite jumps to the invite box.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { useTeacher, initials } from "@/lib/classroom/teacherData";
import { FirstGroup } from "./TeacherLayout";
import { PageHeader, PrivacyLine, SectionTitle, cardCls, linkCls, outlineBtn, primaryBtn } from "./ui";
import { downloadStudentsCsv } from "./csv";

export default function TeacherStudents() {
  const { groups, students, invites, reload } = useTeacher();
  const { toast } = useToast();
  const location = useLocation();
  const [groupId, setGroupId] = useState(groups[0]?.school_id || "");
  const [emails, setEmails] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const group = groups.find((g) => g.school_id === groupId) ?? groups[0];
  const roster = students.filter((s) => s.school_id === group?.school_id);
  const pending = invites.filter((i) => i.school_id === group?.school_id && i.status === "pending");

  useEffect(() => {
    if (location.hash === "#invite") document.getElementById("invite")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash]);

  const invite = async () => {
    if (!group) return;
    const list = emails.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
    if (!list.length) return;
    if (list.some((e) => !z.string().email().safeParse(e).success)) {
      toast({ title: "Check the email addresses", description: "No links were made. Fix any address that isn't an email and try again.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("bulk_invite_students", { _school_id: group.school_id, _emails: list });
    setBusy(false);
    if (error) { toast({ title: "Couldn't make invite links", description: error.message, variant: "destructive" }); return; }
    track("teacher_student_invited", { count: list.length });
    toast({ title: `${data} invite link${data === 1 ? "" : "s"} ready`, description: "Copy each link and send it to that student. We don't email them." });
    setEmails("");
    await reload();
  };

  const copy = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/auth?invite=${token}`);
    toast({ title: "Invite link copied" });
  };

  return (
    <>
      <PageHeader title="Students" sub="Invite students to a group. They join with the email you invite."
        actions={<button type="button" className={outlineBtn} onClick={() => setAdding((v) => !v)}>{adding ? "Close" : "New group"}</button>} />

      {adding && <div className={`${cardCls} max-w-xl p-6`}><FirstGroup compact onDone={() => setAdding(false)} /></div>}

      <div role="tablist" aria-label="Group" className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button key={g.school_id} type="button" role="tab" aria-selected={group?.school_id === g.school_id} onClick={() => setGroupId(g.school_id)}
            className={`h-10 rounded-full px-4 text-sm font-semibold ${group?.school_id === g.school_id ? "bg-[#F2F2F5] text-[#0B0B0D]" : "border border-[#2A2A30] text-[#A1A1AA] hover:text-[#F2F2F5]"}`}>
            {g.name} <span className="ml-1 opacity-60">{students.filter((s) => s.school_id === g.school_id).length}</span>
          </button>
        ))}
      </div>

      {group && (
        <div className="flex flex-wrap items-start gap-6">
          <section id="invite" aria-labelledby="inv-h" className="flex min-w-0 flex-[1_1_320px] scroll-mt-6 flex-col gap-3.5">
            <SectionTitle id="inv-h">Invite to {group.name}</SectionTitle>
            <div className={`${cardCls} flex flex-col gap-3 p-5`}>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
                Student emails
                <textarea rows={4} value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="ana@example.com, mateo@example.com"
                  className="w-full rounded-xl border border-[#2A2A30] bg-[#0F0F12] p-3 text-sm text-[#F2F2F5] placeholder:text-[#6B6B75] focus:border-[#34C759] focus:outline-none" />
              </label>
              <button type="button" className={`${primaryBtn} self-start`} disabled={busy || !emails.trim()} onClick={() => void invite()}>
                {busy ? "Making links…" : "Make invite links"}
              </button>
              {pending.length > 0 && (
                <div className="flex flex-col gap-2 border-t border-[#1E1E23] pt-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#8E8E98]">Waiting to join · {pending.length}</span>
                  {pending.map((i) => (
                    <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">{i.email}</span>
                      <button type="button" className={linkCls} onClick={() => void copy(i.token)}>Copy link</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section aria-labelledby="roster-h" className="flex min-w-0 flex-[2_1_480px] flex-col gap-3.5">
            <SectionTitle id="roster-h" right={roster.length > 0 && (
              <button type="button" className={linkCls} onClick={() => downloadStudentsCsv(group.name, roster)}>Download for Google Sheets</button>
            )}>{group.name} · {roster.length} {roster.length === 1 ? "student" : "students"}</SectionTitle>
            <div className={`${cardCls} overflow-x-auto`}>
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-[0.06em] text-[#8E8E98]">
                  <th className="px-5 py-3.5 font-semibold">Student</th>
                  <th className="px-3 py-3.5 font-semibold">Clips started</th>
                  <th className="px-3 py-3.5 font-semibold">Clips finished</th>
                  <th className="px-5 py-3.5 font-semibold">Last clip activity</th>
                </tr></thead>
                <tbody>
                  {roster.map((s) => (
                    <tr key={s.user_id} className="border-t border-[#1E1E23]">
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1F25] text-[13px] text-[#A1A1AA]">{initials(s.display_name)}</span>
                          <span className="flex flex-col"><b className="font-semibold">{s.display_name}</b><span className="text-xs text-[#8E8E98]">{s.email}</span></span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[#D4D4D8]">{s.tasks_started}/{s.tasks_set}</td>
                      <td className="px-3 py-3.5 text-[#D4D4D8]">{s.tasks_done}/{s.tasks_set}</td>
                      <td className="px-5 py-3.5 text-[#D4D4D8]">{s.last_task_activity ? new Date(s.last_task_activity).toLocaleDateString() : "Not started"}</td>
                    </tr>
                  ))}
                  {roster.length === 0 && <tr><td colSpan={4} className="px-5 py-6 text-center text-[#A1A1AA]">Nobody has joined {group.name} yet. Make invite links and send them.</td></tr>}
                </tbody>
              </table>
            </div>
            <p className="m-0 text-xs text-[#8E8E98]">Downloads contain names and emails. Keep them safe.</p>
          </section>
        </div>
      )}

      <PrivacyLine>You only see the clips you set, counted from when you set them. Not anything else a student watches, their saved words, streak or when they open the app. Students can leave a group any time.</PrivacyLine>
    </>
  );
}
