import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CountUp, PremiumHeader } from "@/components/premium";
import { ExperienceNav, MovingWords } from "@/components/premium/ExperienceNav";
import "@/components/premium/cinema.css";
import { Loader2, Copy, GraduationCap, Plus, Users, Download, Film, Trash2, ShieldCheck } from "lucide-react";
import { PageLoading } from "@/components/PageLoading";
import { z } from "zod";

interface School { school_id: string; name: string; slug: string; member_role: string; }
// Teachers see ONLY the videos they set as tasks, counted from viewing after
// the task was set and after the student joined (see the 0016 migration).
// No app-wide minutes, streaks, saved words or logins reach this page.
interface Student {
  user_id: string; display_name: string; email: string; joined_at: string;
  tasks_set: number; tasks_started: number; tasks_done: number;
  last_task_activity: string | null;
}
interface Task {
  id: string; film_id: string; note: string | null; due_at: string | null; created_at: string;
  title: string; thumbnail_url: string | null;
}
interface TaskProgress {
  assignment_id: string; user_id: string; watched_pct: number | null;
  watch_count: number | null; green_pct: number | null; last_watched_at: string | null;
}

const DAY = 86400000;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function taskStatus(st: Student): { label: string; tone: string } {
  if (st.tasks_set === 0) return { label: "No tasks yet", tone: "bg-secondary text-secondary-foreground" };
  if (st.tasks_done >= st.tasks_set) return { label: "All tasks done", tone: "bg-primary/15 text-primary" };
  if (!st.last_task_activity) return { label: "Not started", tone: "bg-destructive/15 text-destructive" };
  const days = Math.floor((Date.now() - new Date(st.last_task_activity).getTime()) / DAY);
  return { label: days === 0 ? "Watched today" : `Watched ${days}d ago`, tone: "bg-secondary text-secondary-foreground" };
}
const pct = (n: number | null) => (n == null ? "–" : `${Math.round(Number(n))}%`);

function downloadCsv(name: string, rows: Student[]) {
  const head = ["Name", "Email", "Tasks set", "Tasks started", "Tasks finished", "Last task activity"];
  const esc = (v: unknown) => {
    const text = String(v ?? "");
    const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const body = rows.map((r) => [r.display_name, r.email, r.tasks_set, r.tasks_started, r.tasks_done, r.last_task_activity?.slice(0, 10)].map(esc).join(","));
  const blob = new Blob([[head.join(","), ...body].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}-video-tasks.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
interface Invite { id: string; email: string; token: string; status: string; created_at: string; }

export default function Teacher() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [schools, setSchools] = useState<School[]>([]);
  const [selected, setSelected] = useState<School | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [emailList, setEmailList] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Map<string, TaskProgress>>(new Map());
  const [videoLink, setVideoLink] = useState("");
  const [taskNote, setTaskNote] = useState("");
  const [taskDue, setTaskDue] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/teacher");
  }, [authLoading, user, navigate]);

  const loadSchools = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("my_schools");
    if (error) { setLoadError("Your school workspace couldn't load. Please try again."); setLoading(false); return; }
    setLoadError("");
    // Students use their learning pages, not staff reports or invitation controls.
    const list = ((data || []) as School[]).filter(s => s.member_role === "teacher" || s.member_role === "school_admin");
    setSchools(list);
    if (list.length && !selected) setSelected(list[0]);
    setLoading(false);
  };

  useEffect(() => { if (user) void loadSchools(); }, [user]);

  const loadStudents = async (schoolId: string): Promise<Student[]> => {
    const result = await supabase.rpc("school_class_progress", { _school_id: schoolId });
    if (result.error) throw result.error;
    return (result.data || []) as Student[];
  };

  const loadTasks = async (schoolId: string): Promise<Task[]> => {
    const { data, error } = await supabase.from("class_assignments")
      .select("id, film_id, note, due_at, created_at")
      .eq("school_id", schoolId).order("created_at", { ascending: false });
    if (error) throw error;
    const list = data || [];
    if (!list.length) return [];
    const { data: films } = await supabase.from("films").select("id, title, thumbnail_url")
      .in("id", list.map((t) => t.film_id));
    const fmap = new Map((films || []).map((f) => [f.id, f]));
    return list.map((t) => ({
      ...t,
      title: fmap.get(t.film_id)?.title || "Video",
      thumbnail_url: fmap.get(t.film_id)?.thumbnail_url || null,
    }));
  };

  const loadSchoolData = async (s: School) => {
    setReportLoading(true); setLoadError(""); setStudents([]); setInvites([]); setTasks([]); setProgress(new Map());
    try {
    const [stu, inv, tk, pr] = await Promise.all([
      loadStudents(s.school_id),
      supabase.from("school_invites").select("id,email,token,status,created_at")
        .eq("school_id", s.school_id).order("created_at", { ascending: false }),
      loadTasks(s.school_id),
      supabase.rpc("class_assignment_progress", { _school_id: s.school_id }),
    ]);
    if (inv.error) throw inv.error;
    if (pr.error) throw pr.error;
    setStudents(stu);
    setInvites((inv.data || []) as Invite[]);
    setTasks(tk);
    setProgress(new Map(((pr.data || []) as TaskProgress[]).map((p) => [`${p.assignment_id}:${p.user_id}`, p])));
    } catch { setLoadError("Class data couldn't load. No totals are shown until we can confirm them."); }
    finally { setReportLoading(false); }
  };

  useEffect(() => { if (selected) void loadSchoolData(selected); }, [selected]);

  const createSchool = async () => {
    if (!newName.trim() || !/^[a-z0-9-]{3,40}$/.test(newSlug)) {
      toast({ title: "Invalid", description: "Slug must be 3–40 chars, a–z, 0–9, hyphens.", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("create_school", { _name: newName.trim(), _slug: newSlug });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "School created" });
    setNewName(""); setNewSlug("");
    await loadSchools();
  };

  const sendInvites = async () => {
    if (!selected) return;
    const emails = emailList.split(/[\s,;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (!emails.length) return;
    if (emails.some(e => !z.string().email().safeParse(e).success)) {
      toast({ title: "Check the email addresses", description: "No links were generated. Correct any invalid email address and try again.", variant: "destructive" }); return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("bulk_invite_students", {
      _school_id: selected.school_id, _emails: emails,
    });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `${data} invitation link(s) generated`, description: "Copy and share each link yourself. No invitation emails were sent." });
    setEmailList("");
    await loadSchoolData(selected);
  };

  const addTask = async () => {
    if (!selected) return;
    const filmId = videoLink.match(UUID_RE)?.[0];
    if (!filmId) {
      toast({ title: "Paste a LinguaScript video link", description: "Open the video in LinguaScript and copy the address, e.g. linguascript.co.uk/watch/…", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("create_class_assignment", {
      _school_id: selected.school_id, _film_id: filmId,
      _note: taskNote.trim() || null,
      _due_at: taskDue ? new Date(`${taskDue}T23:59:00`).toISOString() : null,
    });
    setBusy(false);
    if (error) { toast({ title: "Couldn't set the task", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Video task set", description: "Your students see it in My classes. They're told you can see their progress on this video only." });
    setVideoLink(""); setTaskNote(""); setTaskDue("");
    await loadSchoolData(selected);
  };

  const removeTask = async (t: Task) => {
    if (!selected) return;
    const { error } = await supabase.rpc("delete_class_assignment", { _assignment_id: t.id });
    if (error) { toast({ title: "Couldn't remove it", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Task removed", description: "You no longer see anyone's progress on that video." });
    await loadSchoolData(selected);
  };

  const inviteLink = (token: string) =>
    `${window.location.origin}/auth?invite=${token}`;

  const copy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    toast({ title: "Copied" });
  };

  if (authLoading || !user || loading) {
    return <PageLoading />;
  }

  return (
    <div className="min-h-screen ls-cinema text-foreground">
      <PremiumHeader title="Teacher dashboard" onBack={() => navigate("/discover")} icon={<GraduationCap className="h-5 w-5 text-primary" />} right={<Button asChild variant="outline" size="sm"><Link to="/for-schools">Schools</Link></Button>} />
      <div className="ls-teacher-content max-w-6xl mx-auto space-y-8 px-5 py-8 md:px-8">
        <ExperienceNav />
        <header className="flex items-center gap-4 py-3">
          <img src="/logo.svg" alt="LinguaScript chameleon" width="52" height="52" className="ls-mascot-float" />
          <div>
            <p className="mb-2 text-xs font-semibold text-warning">YOUR SCHOOL · YOUR STUDENTS</p>
            <h2 className="text-3xl font-bold">See your class grow.</h2>
            <p className="text-sm text-muted-foreground">Set video tasks, see who watched them, and invite students.</p>
          </div>
        </header>
        <MovingWords />
        {loadError && <section role="alert" className="space-y-3"><p className="text-destructive">{loadError}</p><Button variant="outline" onClick={() => selected ? void loadSchoolData(selected) : void loadSchools()}>Try loading again</Button></section>}
        {reportLoading && <p role="status" className="text-muted-foreground">Loading your class records…</p>}

        {schools.length === 0 && !loadError && (
          <section className="space-y-4">
            <h2 className="font-semibold">Create your school</h2>
            <p className="text-sm text-muted-foreground">Start with your school name and an address identifier, such as truro-college.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input aria-label="School name" placeholder="School name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input aria-label="School address identifier" placeholder="slug (lowercase, hyphens)" value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase())} />
            </div>
            <Button onClick={createSchool} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Create school</>}
            </Button>
          </section>
        )}

        {schools.length > 0 && (
          <>
            <div className="flex gap-2 flex-wrap">
              {schools.map((s) => (
                <Button key={s.school_id} size="sm"
                  variant={selected?.school_id === s.school_id ? "default" : "outline"}
                  onClick={() => setSelected(s)}>
                  {s.name} <span className="opacity-60 ml-2 text-xs">{s.member_role}</span>
                </Button>
              ))}
            </div>

            {selected && (
              <>
                <section className="space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Bulk invite students</h2>
                  <p className="text-sm text-muted-foreground">Paste invited student emails, then copy and share their links. Each student must sign in with that email. No email is sent automatically.</p>
                  <Textarea aria-label="Student email addresses" rows={5} value={emailList} onChange={(e) => setEmailList(e.target.value)}
                    placeholder="student1@school.ac.uk, student2@school.ac.uk…" />
                  <Button onClick={sendInvites} disabled={busy || !emailList.trim()}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate invite links"}
                  </Button>
                </section>

                <section>
                  <h2 className="font-semibold mb-4">Pending invites ({invites.filter(i => i.status === "pending").length})</h2>
                  <div className="space-y-2 max-h-80 overflow-auto">
                    {invites.map((inv) => (
                      <div key={inv.id} className="flex items-center justify-between gap-2 text-sm border border-border rounded-md px-3 py-2">
                        <div className="truncate">
                          <span className="font-medium">{inv.email}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{inv.status}</span>
                        </div>
                        {inv.status === "pending" && (
                          <Button size="sm" variant="ghost" onClick={() => copy(inviteLink(inv.token))}>
                            <Copy className="w-3 h-3 mr-1" />Copy link
                          </Button>
                        )}
                      </div>
                    ))}
                    {invites.length === 0 && <p className="text-sm text-muted-foreground">No invites yet.</p>}
                  </div>
                </section>

                <section className="ls-teacher-stat flex gap-3 items-start">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    <b className="text-foreground">Privacy:</b> you only see the videos you set here, and only
                    viewing after you set the task. You can't see anything else a student watches, their saved
                    words, streak or when they open the app. Students are shown exactly this before they watch,
                    and can leave your class at any time.
                  </p>
                </section>

                <section className="space-y-3">
                  <h2 className="font-semibold flex items-center gap-2"><Film className="w-4 h-4" /> Set a video task</h2>
                  <p className="text-sm text-muted-foreground">Open the video in LinguaScript, copy its link, and paste it here. Short videos work best: students rewatch until the words turn green.</p>
                  <Input aria-label="LinguaScript video link" placeholder="https://linguascript.co.uk/watch/…" value={videoLink} onChange={(e) => setVideoLink(e.target.value)} />
                  <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                    <Input aria-label="Note for students" placeholder="Note for students (optional), e.g. Watch twice and save 5 words" maxLength={500} value={taskNote} onChange={(e) => setTaskNote(e.target.value)} />
                    <Input aria-label="Due date" type="date" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
                  </div>
                  <Button onClick={addTask} disabled={busy || !videoLink.trim()}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Set task</>}
                  </Button>
                </section>

                {!loadError && !reportLoading && (() => {
                  const done = students.reduce((a, st) => a + st.tasks_done, 0);
                  const started = students.reduce((a, st) => a + st.tasks_started, 0);
                  const possible = students.length * tasks.length;
                  const stats: [string, number | string][] = [
                    ["Students", students.length],
                    ["Video tasks", tasks.length],
                    ["Tasks started", possible ? `${started}/${possible}` : "–"],
                    ["Tasks finished", possible ? `${done}/${possible}` : "–"],
                  ];
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {stats.map(([k, v]) => (
                        <section key={k} className="ls-teacher-stat">
                          <div className="text-3xl font-bold text-primary">{typeof v === "number" ? <CountUp value={v} /> : v}</div>
                          <div className="text-xs text-muted-foreground">{k}</div>
                        </section>
                      ))}
                    </div>
                  );
                })()}

                {!loadError && !reportLoading && tasks.length > 0 && <section className="space-y-4">
                  <h2 className="font-semibold">Video tasks</h2>
                  <p className="text-xs text-muted-foreground">"Watched" is how far into the video they got. "Green" is how much of the video's language they know (it rises with each rewatch). These are practice records, not grades.</p>
                  {tasks.map((t) => (
                    <div key={t.id} className="border border-border rounded-xl p-3 space-y-3">
                      <div className="flex items-start gap-3">
                        {t.thumbnail_url && <img src={t.thumbnail_url} alt="" className="w-24 aspect-video object-cover rounded-md" />}
                        <div className="flex-1 min-w-0">
                          <Link to={`/watch/${t.film_id}`} className="font-medium hover:underline">{t.title}</Link>
                          <div className="text-xs text-muted-foreground">
                            Set {new Date(t.created_at).toLocaleDateString()}{t.due_at ? ` · Due ${new Date(t.due_at).toLocaleDateString()}` : ""}
                          </div>
                          {t.note && <p className="text-sm mt-1">{t.note}</p>}
                        </div>
                        <Button size="sm" variant="ghost" aria-label={`Remove task ${t.title}`} onClick={() => removeTask(t)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="ls-teacher-table w-full text-sm">
                          <thead className="text-muted-foreground text-xs uppercase">
                            <tr>
                              <th className="text-left py-1 pr-3">Student</th>
                              <th className="text-right py-1 pr-3">Watched</th>
                              <th className="text-right py-1 pr-3">Watches</th>
                              <th className="text-right py-1 pr-3">Green</th>
                              <th className="text-right py-1 pr-3">Last watched</th>
                            </tr>
                          </thead>
                          <tbody>
                            {students.map((st) => {
                              const p = progress.get(`${t.id}:${st.user_id}`);
                              return (
                                <tr key={st.user_id} className="border-t border-border">
                                  <td className="py-1 pr-3">{st.display_name}</td>
                                  <td className="py-1 pr-3 text-right">{pct(p?.watched_pct ?? null)}</td>
                                  <td className="py-1 pr-3 text-right">{p?.watch_count ?? "–"}</td>
                                  <td className="py-1 pr-3 text-right">{pct(p?.green_pct ?? null)}</td>
                                  <td className="py-1 pr-3 text-right">{p?.last_watched_at ? new Date(p.last_watched_at).toLocaleDateString() : "Not started"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </section>}

                {!loadError && !reportLoading && <section>
                  <div className="flex items-center justify-between mb-4 gap-2">
                    <h2 className="font-semibold">Class</h2>
                    <Button size="sm" variant="outline" disabled={!students.length} onClick={() => downloadCsv(selected.slug, students)}>
                      <Download className="w-4 h-4 mr-1" />Download CSV
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">A task counts as finished when the student has watched at least 90% of it. CSV exports contain personal data (names and emails) — store them safely.</p>
                  <div className="overflow-x-auto">
                    <table className="ls-teacher-table w-full text-sm">
                      <thead className="text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="text-left py-2 pr-3">Student</th>
                          <th className="text-left py-2 pr-3">Tasks</th>
                          <th className="text-right py-2 pr-3">Started</th>
                          <th className="text-right py-2 pr-3">Finished</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st) => {
                          const status = taskStatus(st);
                          return (
                            <tr key={st.user_id} className="border-t border-border">
                              <td className="py-2 pr-3">
                                <div className="font-medium">{st.display_name}</div>
                                <div className="text-xs text-muted-foreground">{st.email}</div>
                              </td>
                              <td className="py-2 pr-3"><span className={`text-xs rounded-full px-2 py-0.5 whitespace-nowrap ${status.tone}`}>{status.label}</span></td>
                              <td className="py-2 pr-3 text-right">{st.tasks_started}/{st.tasks_set}</td>
                              <td className="py-2 pr-3 text-right">{st.tasks_done}/{st.tasks_set}</td>
                            </tr>
                          );
                        })}
                        {students.length === 0 && (
                          <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">
                            No students have joined yet. Invite them above and share their links.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
