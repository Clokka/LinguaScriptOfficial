// One loader for every /teacher page (Today, Clip lessons, Students, Class
// words, Calendar). It reads ONLY what the 0016 privacy RPCs allow: the clips a
// teacher set and viewing of those clips after they were set. Nothing app-wide.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Group { school_id: string; name: string; slug: string; member_role: string }
export interface Student {
  school_id: string; user_id: string; display_name: string; email: string; joined_at: string;
  tasks_set: number; tasks_started: number; tasks_done: number; last_task_activity: string | null;
}
export interface Invite { id: string; school_id: string; email: string; token: string; status: string; created_at: string }
export type ClipStatus = "done" | "going" | "not";
export interface ClipStudent {
  user_id: string; name: string; watched_pct: number | null; watch_count: number | null;
  green_pct: number | null; last_watched_at: string | null; status: ClipStatus;
}
export interface Clip {
  id: string; school_id: string; group: string; film_id: string; title: string;
  thumbnail_url: string | null; duration_seconds: number | null; note: string | null;
  due_at: string | null; created_at: string; students: ClipStudent[];
  doneN: number; goingN: number; notN: number; avgGreen: number | null; live: boolean;
}
export interface TeacherData {
  groups: Group[]; students: Student[]; invites: Invite[]; clips: Clip[];
  loading: boolean; error: string; reload: () => Promise<void>;
}

const DAY = 86400000;
export const FINISHED_PCT = 90; // same rule as school_class_progress

export function useTeacherLoader(enabled: boolean): TeacherData {
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data: g, error: gErr } = await supabase.rpc("my_schools");
      if (gErr) throw gErr;
      const mine = ((g || []) as Group[]).filter((s) => s.member_role === "teacher" || s.member_role === "school_admin");
      const ids = mine.map((s) => s.school_id);
      const perGroup = await Promise.all(mine.map(async (s) => {
        const [st, pr] = await Promise.all([
          supabase.rpc("school_class_progress", { _school_id: s.school_id }),
          supabase.rpc("class_assignment_progress", { _school_id: s.school_id }),
        ]);
        if (st.error) throw st.error;
        if (pr.error) throw pr.error;
        return { s, st: (st.data || []) as Omit<Student, "school_id">[], pr: pr.data || [] };
      }));
      const [inv, tasks] = ids.length ? await Promise.all([
        supabase.from("school_invites").select("id,school_id,email,token,status,created_at").in("school_id", ids).order("created_at", { ascending: false }),
        supabase.from("class_assignments").select("id, school_id, film_id, note, due_at, created_at").in("school_id", ids),
      ]) : [{ data: [], error: null }, { data: [], error: null }];
      if (inv.error) throw inv.error;
      if (tasks.error) throw tasks.error;
      const filmIds = [...new Set((tasks.data || []).map((t) => t.film_id))];
      const { data: films } = filmIds.length
        ? await supabase.from("films").select("id, title, thumbnail_url, duration_seconds").in("id", filmIds)
        : { data: [] };
      const fmap = new Map((films || []).map((f) => [f.id, f]));

      const allStudents: Student[] = perGroup.flatMap(({ s, st }) => st.map((x) => ({ ...x, school_id: s.school_id })));
      const progress = new Map<string, any>();
      perGroup.forEach(({ pr }) => pr.forEach((p: any) => progress.set(`${p.assignment_id}:${p.user_id}`, p)));
      const now = Date.now();

      const built: Clip[] = (tasks.data || []).map((t) => {
        const f = fmap.get(t.film_id);
        const group = mine.find((s) => s.school_id === t.school_id)?.name || "Class";
        const roster = allStudents.filter((st) => st.school_id === t.school_id);
        const cs: ClipStudent[] = roster.map((st) => {
          const p = progress.get(`${t.id}:${st.user_id}`);
          const w = p?.watched_pct == null ? null : Number(p.watched_pct);
          const status: ClipStatus = w != null && w >= FINISHED_PCT ? "done" : (w != null && w > 0) || p?.last_watched_at ? "going" : "not";
          return {
            user_id: st.user_id, name: st.display_name, watched_pct: w,
            watch_count: p?.watch_count ?? null, green_pct: p?.green_pct == null ? null : Number(p.green_pct),
            last_watched_at: p?.last_watched_at ?? null, status,
          };
        });
        const greens = cs.map((c) => c.green_pct).filter((v): v is number => v != null);
        return {
          ...t, group, title: f?.title || "Video", thumbnail_url: f?.thumbnail_url || null,
          duration_seconds: f?.duration_seconds ?? null, students: cs,
          doneN: cs.filter((c) => c.status === "done").length,
          goingN: cs.filter((c) => c.status === "going").length,
          notN: cs.filter((c) => c.status === "not").length,
          avgGreen: greens.length ? Math.round(greens.reduce((a, b) => a + b, 0) / greens.length) : null,
          live: !t.due_at || new Date(t.due_at).getTime() >= now - 3 * DAY,
        };
      });
      // Live first, then clips someone still has to finish, soonest due first; then newest.
      const allDone = (c: Clip) => c.students.length > 0 && c.doneN === c.students.length;
      built.sort((a, b) => Number(b.live) - Number(a.live)
        || Number(allDone(a)) - Number(allDone(b))
        || (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity)
        || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setGroups(mine); setStudents(allStudents); setInvites((inv.data || []) as Invite[]); setClips(built);
    } catch {
      setError("Your classroom couldn't load. No totals are shown until we can confirm them.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (enabled) void reload(); }, [enabled, reload]);
  return useMemo(() => ({ groups, students, invites, clips, loading, error, reload }),
    [groups, students, invites, clips, loading, error, reload]);
}

export const TeacherContext = createContext<TeacherData | null>(null);
export function useTeacher(): TeacherData {
  const v = useContext(TeacherContext);
  if (!v) throw new Error("useTeacher must be used inside TeacherLayout");
  return v;
}

/* Small formatting helpers shared by the pages. */
export function clipLength(sec: number | null): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60), s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function dueLabel(c: Clip): { text: string; color: string } {
  if (c.students.length && c.doneN === c.students.length) return { text: "Done", color: "#34C759" };
  if (!c.due_at) return { text: "No due date", color: "#A1A1AA" };
  const due = new Date(c.due_at);
  const days = (due.getTime() - Date.now()) / DAY;
  if (days < 0) return { text: "Overdue", color: "#FF9F0A" };
  const day = days < 1 && due.getDate() === new Date().getDate() ? "today" : due.toLocaleDateString(undefined, { weekday: "short" });
  return { text: `Due ${day}`, color: days <= 3 ? "#FF9F0A" : "#A1A1AA" };
}
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
}
export function slugFor(name: string): string {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "class";
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}
