import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Loader2, Copy, GraduationCap, Plus, Users } from "lucide-react";

interface School { school_id: string; name: string; slug: string; member_role: string; }
interface Student {
  user_id: string; display_name: string; email: string;
  xp_total: number; xp_level: number; streak_count: number;
  words_known: number; minutes_watched: number; joined_at: string;
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

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/teacher");
  }, [authLoading, user, navigate]);

  const loadSchools = async () => {
    setLoading(true);
    const { data } = await supabase.rpc("my_schools");
    const list = (data || []) as School[];
    setSchools(list);
    if (list.length && !selected) setSelected(list[0]);
    setLoading(false);
  };

  useEffect(() => { if (user) void loadSchools(); }, [user]);

  const loadSchoolData = async (s: School) => {
    const [stu, inv] = await Promise.all([
      supabase.rpc("list_school_students", { _school_id: s.school_id }),
      supabase.from("school_invites").select("id,email,token,status,created_at")
        .eq("school_id", s.school_id).order("created_at", { ascending: false }),
    ]);
    setStudents((stu.data || []) as Student[]);
    setInvites((inv.data || []) as Invite[]);
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
    setBusy(true);
    const { data, error } = await supabase.rpc("bulk_invite_students", {
      _school_id: selected.school_id, _emails: emails,
    });
    setBusy(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Invited ${data} student(s)` });
    setEmailList("");
    await loadSchoolData(selected);
  };

  const inviteLink = (token: string) =>
    `${window.location.origin}/auth?invite=${token}`;

  const copy = async (txt: string) => {
    await navigator.clipboard.writeText(txt);
    toast({ title: "Copied" });
  };

  if (authLoading || loading) {
    return <div className="min-h-screen grid place-items-center bg-background"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center gap-3">
          <GraduationCap className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Teacher dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your school, students, and invites.</p>
          </div>
        </header>

        {schools.length === 0 && (
          <Card className="p-6 space-y-4">
            <h2 className="font-semibold">Create your school</h2>
            <p className="text-sm text-muted-foreground">e.g. Truro College → slug: truro-college</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <Input placeholder="School name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <Input placeholder="slug (lowercase, hyphens)" value={newSlug}
                onChange={(e) => setNewSlug(e.target.value.toLowerCase())} />
            </div>
            <Button onClick={createSchool} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-2" />Create school</>}
            </Button>
          </Card>
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
                <Card className="p-6 space-y-4">
                  <h2 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Bulk invite students</h2>
                  <p className="text-sm text-muted-foreground">Paste student emails (comma, space, or newline separated).</p>
                  <Textarea rows={5} value={emailList} onChange={(e) => setEmailList(e.target.value)}
                    placeholder="student1@school.ac.uk, student2@school.ac.uk…" />
                  <Button onClick={sendInvites} disabled={busy || !emailList.trim()}>
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate invite links"}
                  </Button>
                </Card>

                <Card className="p-6">
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
                </Card>

                <Card className="p-6">
                  <h2 className="font-semibold mb-4">Students ({students.length})</h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-muted-foreground text-xs uppercase">
                        <tr>
                          <th className="text-left py-2 pr-3">Student</th>
                          <th className="text-left py-2 pr-3">Email</th>
                          <th className="text-right py-2 pr-3">XP</th>
                          <th className="text-right py-2 pr-3">Level</th>
                          <th className="text-right py-2 pr-3">Streak</th>
                          <th className="text-right py-2 pr-3">Words</th>
                          <th className="text-right py-2 pr-3">Minutes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {students.map((st) => (
                          <tr key={st.user_id} className="border-t border-border">
                            <td className="py-2 pr-3">{st.display_name}</td>
                            <td className="py-2 pr-3 text-muted-foreground">{st.email}</td>
                            <td className="py-2 pr-3 text-right">{st.xp_total}</td>
                            <td className="py-2 pr-3 text-right">{st.xp_level}</td>
                            <td className="py-2 pr-3 text-right">{st.streak_count}</td>
                            <td className="py-2 pr-3 text-right">{st.words_known}</td>
                            <td className="py-2 pr-3 text-right">{st.minutes_watched}</td>
                          </tr>
                        ))}
                        {students.length === 0 && (
                          <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">
                            No students have joined yet.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
