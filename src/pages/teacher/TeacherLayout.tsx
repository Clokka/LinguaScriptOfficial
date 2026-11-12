// LinguaScript Classroom shell: sidebar + the page for the current path.
//   /teacher            Today (dashboard)
//   /teacher/clips      Clip lessons        /teacher/clips/new  New clip lesson
//   /teacher/students   Students + invites  /teacher/words      Class words
//   /teacher/calendar   Google Calendar
// Every page reads the same data through useTeacher() (src/lib/classroom/teacherData.ts).
import { Suspense, useContext, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageLoading } from "@/components/PageLoading";
import { Skeleton } from "@/components/premium";
import { TeacherContext, useTeacherLoader, slugFor } from "@/lib/classroom/teacherData";
import { Chameleon, Icon, cardCls, inputCls, primaryBtn } from "./ui";
import { track } from "@/lib/analytics";

const NAV = [
  { to: "/teacher", label: "Today", icon: Icon.home, end: true },
  { to: "/teacher/clips", label: "Clip lessons", icon: Icon.film },
  { to: "/teacher/students", label: "Students", icon: Icon.users },
  { to: "/teacher/words", label: "Class words", icon: Icon.book },
  { to: "/teacher/calendar", label: "Calendar", icon: Icon.calendar },
];

export default function TeacherLayout() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const data = useTeacherLoader(!!user);

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?next=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  }, [authLoading, user, navigate, location.pathname, location.search]);

  if (authLoading || !user || (data.loading && !data.groups.length && !data.error)) return <PageLoading />;

  const studentCount = data.students.length;

  return (
    <TeacherContext.Provider value={data}>
      <div className="flex min-h-screen flex-wrap items-stretch bg-[#0B0B0D] font-sans text-[#F2F2F5]">
        <nav aria-label="Classroom" className="box-border flex w-full flex-col gap-5 border-b border-[#1E1E23] px-4 py-4 md:w-[240px] md:flex-none md:gap-7 md:border-b-0 md:border-r md:px-5 md:py-7">
          <NavLink to="/teacher" end className="flex items-center gap-2.5" aria-label="LinguaScript Classroom home">
            <Chameleon size={44} />
            <span className="flex flex-col">
              <span className="text-[17px] font-bold tracking-[-0.01em]">Lingua<span className="text-[#34C759]">Script</span></span>
              <span className="text-xs font-medium text-[#8E8E98]">Classroom</span>
            </span>
          </NavLink>
          <div className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0">
            {NAV.map(({ to, label, icon: I, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex flex-none items-center gap-3 whitespace-nowrap rounded-xl px-3 py-[11px] text-sm transition-colors ${isActive ? "bg-[#17171B] font-semibold text-[#F2F2F5]" : "font-medium text-[#A1A1AA] hover:text-[#F2F2F5]"}`}>
                <I />{label}
              </NavLink>
            ))}
          </div>
          <div className="mt-auto hidden flex-col gap-2.5 rounded-2xl border border-[#1E1E23] bg-[#131316] p-4 md:flex">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#8E8E98]">Your classroom</span>
            <span className="text-sm font-semibold">{studentCount} {studentCount === 1 ? "student" : "students"} · {data.groups.length} {data.groups.length === 1 ? "group" : "groups"}</span>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#232329]"><div className="h-1.5 rounded-full bg-[#34C759]" style={{ width: `${Math.min(100, (studentCount / 40) * 100)}%` }} /></div>
          </div>
        </nav>

        <main className="box-border flex min-w-0 flex-[999_1_560px] flex-col gap-7 px-4 pb-12 pt-7 md:px-10 md:pt-9">
          {data.error && (
            <div role="alert" className={`${cardCls} flex flex-wrap items-center justify-between gap-3 p-4 text-sm`}>
              <span className="text-[#FF5A4F]">{data.error}</span>
              <button type="button" className="font-semibold text-[#34C759]" onClick={() => void data.reload()}>Try again</button>
            </div>
          )}
          {!data.error && data.groups.length === 0 ? <FirstGroup /> : (
            <Suspense fallback={<div className="flex flex-col gap-4" role="status" aria-label="Loading"><Skeleton className="h-10 w-72 rounded-xl" /><Skeleton className="h-32 rounded-[20px]" /><Skeleton className="h-64 rounded-[20px]" /></div>}>
              <Outlet />
            </Suspense>
          )}
        </main>
      </div>
    </TeacherContext.Provider>
  );
}

/** First visit: make a teaching group (stored as a "school" in the database). */
export function FirstGroup({ compact = false, onDone }: { compact?: boolean; onDone?: () => void }) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const reloadCtx = useTeacherReload();

  const create = async () => {
    const n = name.trim();
    if (n.length < 2) { toast({ title: "Give your group a name", description: "For example: B1 Evening, or Ana · 1-to-1.", variant: "destructive" }); return; }
    setBusy(true);
    const { error } = await supabase.rpc("create_school", { _name: n, _slug: slugFor(n) });
    setBusy(false);
    if (error) { toast({ title: "Couldn't create the group", description: error.message, variant: "destructive" }); return; }
    track("teacher_group_created");
    toast({ title: `${n} is ready`, description: "Next: invite your students and set a clip." });
    setName("");
    await reloadCtx?.();
    onDone?.();
  };

  return (
    <section className={compact ? "flex flex-col gap-3" : `${cardCls} mx-auto mt-6 flex w-full max-w-xl flex-col gap-4 p-8`}>
      {!compact && <Chameleon size={88} />}
      {!compact && <h1 className="m-0 text-[28px] font-extrabold tracking-[-0.02em]">Welcome to LinguaScript Classroom</h1>}
      <p className="m-0 text-[15px] text-[#A1A1AA]">
        {compact ? "Add another group of students." : "Start with one teaching group: a class, or a single student you teach 1-to-1. You can add more later."}
      </p>
      <label className="flex flex-col gap-1.5 text-[13px] font-medium text-[#8E8E98]">
        Group name
        <input className={inputCls} value={name} maxLength={60} placeholder="e.g. B1 Evening" onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void create(); }} />
      </label>
      <button type="button" className={`${primaryBtn} self-start`} disabled={busy} onClick={() => void create()}>
        <Icon.plus />{busy ? "Creating…" : "Create group"}
      </button>
    </section>
  );
}

function useTeacherReload() {
  return useContext(TeacherContext)?.reload;
}
