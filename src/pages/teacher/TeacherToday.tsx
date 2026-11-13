// /teacher — "Today", design A · Calm Command.
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTeacher, initials, FINISHED_PCT, type Clip } from "@/lib/classroom/teacherData";
import { ClipCard, EmptyCard, Icon, PageHeader, PrivacyLine, SectionTitle, StatTile, StatusPill, cardCls, linkCls, outlineBtn, primaryBtn, softBtn } from "./ui";
import { downloadClipCsv } from "./csv";

const DAY = 86400000;
const WORD_STATES = [
  { label: "New", color: "#FF5A4F" }, { label: "Learning", color: "#FF9F0A" }, { label: "Known", color: "#34C759" },
  { label: "Review due", color: "#FFD60A" }, { label: "100% known", color: "#6C8CF2" },
];

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function TeacherToday() {
  const { user } = useAuth();
  const { clips, students } = useTeacher();
  const first = String(user?.user_metadata?.full_name || user?.user_metadata?.name || "").split(" ")[0];
  const live = clips.filter((c) => c.live);

  // A student "finished" when every live clip in their group is ≥ 90% watched.
  const withLive = students.filter((s) => live.some((c) => c.school_id === s.school_id));
  const finished = withLive.filter((s) => live.filter((c) => c.school_id === s.school_id)
    .every((c) => c.students.find((x) => x.user_id === s.user_id)?.status === "done"));
  const soon = (c: Clip) => !c.due_at || new Date(c.due_at).getTime() - Date.now() <= 3 * DAY;
  const nudge = new Set(live.filter(soon).flatMap((c) => c.students.filter((x) => x.status !== "done").map((x) => x.user_id)));
  const pctFinished = withLive.length ? Math.round((finished.length / withLive.length) * 100) : null;
  const greens = live.map((c) => c.avgGreen).filter((v): v is number => v != null);
  const avgGreen = greens.length ? Math.round(greens.reduce((a, b) => a + b, 0) / greens.length) : null;
  const nextDue = live.find((c) => c.due_at && new Date(c.due_at).getTime() >= Date.now());
  const focus = live[0] ?? clips[0];

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const sub = !withLive.length
    ? "Set a clip and your students' progress shows up here."
    : `${finished.length} of ${withLive.length} students finished this week's clips.${nudge.size ? ` ${nudge.size === 1 ? "One needs" : `${nudge.size} need`} a nudge.` : " Nobody needs a nudge."}`;

  return (
    <>
      <PageHeader
        eyebrow={today}
        title={`${greeting()}${first ? `, ${first}` : ""}`}
        sub={sub}
        actions={<>
          <Link to="/teacher/students#invite" className={outlineBtn}>Invite students</Link>
          <Link to="/teacher/clips/new" className={primaryBtn}><Icon.plus />New clip lesson</Link>
        </>}
      />

      <section aria-label="This week" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(190px,1fr))]">
        <StatTile label="Clips live" value={live.length} caption={nextDue ? `Next due ${new Date(nextDue.due_at!).toLocaleDateString(undefined, { weekday: "long" })}` : "No due dates yet"} />
        <StatTile label="Finished" value={pctFinished == null ? "–" : `${pctFinished}%`} color={pctFinished == null ? undefined : "#34C759"}
          caption={withLive.length ? `${finished.length} of ${withLive.length} students` : "No students on a clip yet"} />
        <StatTile label="Words green" value={avgGreen == null ? "–" : `${avgGreen}%`} caption="Average on live clips" />
        <StatTile label="Tricky words" value="–" color="#FF9F0A" caption="Shows after the clip check" />
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-labelledby="clips-h" className="flex min-w-0 flex-[2_1_520px] flex-col gap-3.5">
          <SectionTitle id="clips-h" right={<Link to="/teacher/clips" className={linkCls}>See all</Link>}>Clip lessons</SectionTitle>
          {live.length === 0 && (
            <EmptyCard title="No clips live" action={<Link to="/teacher/clips/new" className={primaryBtn}><Icon.plus />New clip lesson</Link>}>
              Pick a short video, set a due date, and your students get it in My classes.
            </EmptyCard>
          )}
          {live.slice(0, 3).map((c, i) => <ClipCard key={c.id} clip={c} index={i} />)}
        </section>

        <aside aria-labelledby="words-h" className="flex min-w-0 flex-[1_1_300px] flex-col gap-3.5">
          <SectionTitle id="words-h">Class words</SectionTitle>
          <div className={`${cardCls} flex flex-col gap-4 p-5`}>
            <span className="text-[13px] text-[#8E8E98]">Key words from this week's clips</span>
            <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-[#232329]" aria-hidden="true" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
              {WORD_STATES.map((w) => (
                <span key={w.label} className="flex items-center gap-2 text-[#A1A1AA]">
                  <i className="h-2 w-2 rounded-full" style={{ background: w.color }} />{w.label}<b className="ml-auto text-[#F2F2F5]">–</b>
                </span>
              ))}
            </div>
            <p className="m-0 text-xs text-[#8E8E98]">Fills in when students take the 5-question check after a clip.</p>
          </div>
          <div className={`${cardCls} flex flex-col gap-3.5 p-5`}>
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-bold">Tricky for the class</span>
              <span className="text-xs text-[#8E8E98]">missed in the check</span>
            </div>
            <p className="m-0 text-sm text-[#A1A1AA]">Words most of the class gets wrong will show here, ringed in orange.</p>
            <Link to="/teacher/calendar" className={softBtn}>Plan your next lesson</Link>
          </div>
        </aside>
      </div>

      {focus && (
        <section aria-labelledby="st-h" className="flex flex-col gap-3.5">
          <SectionTitle id="st-h" right={focus.students.length > 0 && (
            <button type="button" className={linkCls} onClick={() => downloadClipCsv(focus)}>Download for Google Sheets</button>
          )}>Students · {focus.title}</SectionTitle>
          <div className={`${cardCls} overflow-x-auto`}>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-[0.06em] text-[#8E8E98]">
                  <th className="px-5 py-3.5 font-semibold">Student</th>
                  <th className="px-3 py-3.5 font-semibold">Watched</th>
                  <th className="px-3 py-3.5 font-semibold">Words green</th>
                  <th className="px-3 py-3.5 font-semibold">Check</th>
                  <th className="px-5 py-3.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {focus.students.map((s) => (
                  <tr key={s.user_id} className="border-t border-[#1E1E23]">
                    <td className="px-5 py-3.5 font-semibold">
                      <span className="inline-flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#1F1F25] text-[13px] text-[#A1A1AA]">{initials(s.name)}</span>{s.name}
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-[#D4D4D8]">
                      {s.watched_pct == null ? "0%" : `${Math.round(s.watched_pct)}%`}
                      {s.watch_count && s.watch_count > 1 && s.watched_pct != null && s.watched_pct >= FINISHED_PCT ? ` · ${s.watch_count === 2 ? "twice" : `${s.watch_count}×`}` : ""}
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-2.5">
                        <span className="inline-block h-1.5 w-20 overflow-hidden rounded-full bg-[#232329]"><span className="block h-1.5 bg-[#34C759]" style={{ width: `${s.green_pct ?? 0}%` }} /></span>
                        <span className="text-[#D4D4D8]">{s.green_pct == null ? "–" : `${Math.round(s.green_pct)}%`}</span>
                      </span>
                    </td>
                    <td className="px-3 py-3.5 text-[#D4D4D8]">–</td>
                    <td className="px-5 py-3.5"><StatusPill status={s.status} /></td>
                  </tr>
                ))}
                {focus.students.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-6 text-center text-[#A1A1AA]">
                    No students in {focus.group} yet. <Link to="/teacher/students#invite" className={linkCls}>Invite them</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <PrivacyLine />
    </>
  );
}
