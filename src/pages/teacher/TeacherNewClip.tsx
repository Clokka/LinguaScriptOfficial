// /teacher/clips/new — set a clip lesson for a group.
// Accepts a LinguaScript /watch/<id> link or a YouTube link to a video that is
// already in LinguaScript. Due dates flow into Google Calendar through the
// private feed (/teacher/calendar).
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import { useTeacher } from "@/lib/classroom/teacherData";
import { lessonTemplateUrl } from "@/lib/classroom/calendar";
import { Icon, PageHeader, cardCls, inputCls, outlineBtn, primaryBtn } from "./ui";

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const YT_RE = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})/i;

async function findFilm(link: string): Promise<{ id: string; title: string } | { error: string }> {
  const uuid = link.match(UUID_RE)?.[0];
  if (uuid) {
    const { data } = await supabase.from("films").select("id, title").eq("id", uuid).maybeSingle();
    return data ?? { error: "That LinguaScript video wasn't found." };
  }
  const yt = link.match(YT_RE)?.[1];
  if (yt) {
    const { data } = await supabase.from("films").select("id, title").ilike("url", `%${yt}%`).limit(1).maybeSingle();
    return data ?? { error: "That YouTube video isn't in LinguaScript yet. Open it once in LinguaScript (Discover → paste link), then paste the LinguaScript link here." };
  }
  return { error: "Paste a LinguaScript video link (linguascript.co.uk/watch/…) or a YouTube link." };
}

export default function TeacherNewClip() {
  const { groups, reload } = useTeacher();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [groupId, setGroupId] = useState(params.get("group") || groups[0]?.school_id || "");
  const [link, setLink] = useState(params.get("video") || "");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [time, setTime] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ title: string; filmId: string; group: string; dueAt: Date | null } | null>(null);

  const save = async () => {
    if (!groupId) return;
    setBusy(true);
    const film = await findFilm(link.trim());
    if ("error" in film) { setBusy(false); toast({ title: "Check the video link", description: film.error, variant: "destructive" }); return; }
    const dueAt = due ? new Date(`${due}T${time || "23:59"}:00`) : null;
    const { error } = await supabase.rpc("create_class_assignment", {
      _school_id: groupId, _film_id: film.id, _note: note.trim() || null, _due_at: dueAt ? dueAt.toISOString() : null,
    });
    setBusy(false);
    if (error) { toast({ title: "Couldn't set the clip", description: error.message, variant: "destructive" }); return; }
    track("teacher_clip_created", { has_due_date: !!dueAt });
    await reload();
    setDone({ title: film.title, filmId: film.id, group: groups.find((g) => g.school_id === groupId)?.name || "your group", dueAt });
  };

  if (done) {
    return (
      <section className={`${cardCls} mx-auto flex w-full max-w-xl flex-col gap-4 p-8`}>
        <span className="text-xs font-bold uppercase tracking-[0.08em] text-[#34C759]">Clip set</span>
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em]">{done.title}</h1>
        <p className="m-0 text-[15px] text-[#A1A1AA]">
          Students in {done.group} see it in My classes now{done.dueAt ? `, due ${done.dueAt.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}` : ""}.
          They're told you can see their progress on this video only.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <a className={primaryBtn} target="_blank" rel="noreferrer"
            href={lessonTemplateUrl({ clipTitle: done.title, group: done.group, filmId: done.filmId })}>
            <Icon.calendar />Add to a lesson in Google Calendar
          </a>
          <Link to="/teacher/clips" className={outlineBtn}>See clip lessons</Link>
          <button type="button" className={outlineBtn} onClick={() => { setDone(null); setLink(""); setNote(""); setDue(""); }}>Set another</button>
        </div>
        <p className="m-0 text-xs text-[#8E8E98]">Due dates also appear in your Google Calendar automatically once you've subscribed on the <Link to="/teacher/calendar" className="text-[#34C759]">Calendar</Link> page.</p>
      </section>
    );
  }

  return (
    <>
      <PageHeader title="New clip lesson" sub="Short videos work best: 1–3 minutes students can watch twice until the words turn green." />
      <form className={`${cardCls} flex max-w-2xl flex-col gap-5 p-6`} onSubmit={(e) => { e.preventDefault(); void save(); }}>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
          Group
          <select className={inputCls} value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => <option key={g.school_id} value={g.school_id}>{g.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
          Video link
          <input className={inputCls} value={link} required onChange={(e) => setLink(e.target.value)}
            placeholder="linguascript.co.uk/watch/… or a YouTube link" />
          <span className="text-xs font-normal">Tip: open any video in LinguaScript, then copy the address bar.</span>
        </label>
        <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
          Note for students (optional)
          <input className={inputCls} value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Watch twice and save 5 words" />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-[1_1_200px] flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
            Due date (optional)
            <input className={inputCls} type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </label>
          <label className="flex flex-[1_1_140px] flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
            Due time
            <input className={inputCls} type="time" value={time} disabled={!due} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button type="submit" className={primaryBtn} disabled={busy || !link.trim() || !groupId}><Icon.plus />{busy ? "Setting…" : "Set clip"}</button>
          <button type="button" className={outlineBtn} onClick={() => navigate(-1)}>Cancel</button>
        </div>
      </form>
    </>
  );
}
