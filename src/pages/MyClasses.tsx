// /classes — the student's side of the teacher dashboard: video tasks from each
// class, a plain "what your teacher can see" list, and a Leave class button
// (leave_school RPC: the teacher's access ends straight away).
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, ShieldCheck, Play, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { PremiumHeader } from "@/components/premium";
import { PageLoading } from "@/components/PageLoading";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import "@/components/premium/cinema.css";

interface ClassRow { school_id: string; name: string; }
interface TaskRow {
  assignment_id: string; school_id: string; film_id: string; title: string;
  thumbnail_url: string | null; note: string | null; due_at: string | null;
}

export default function MyClasses() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [leaving, setLeaving] = useState<ClassRow | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/classes");
  }, [authLoading, user, navigate]);

  const load = async () => {
    const [s, t] = await Promise.all([supabase.rpc("my_schools"), supabase.rpc("my_class_tasks")]);
    setClasses((s.data || []).filter((r) => r.member_role === "student").map((r) => ({ school_id: r.school_id, name: r.name })));
    setTasks((t.data || []) as TaskRow[]);
  };
  useEffect(() => { if (user) void load(); }, [user]);

  const leave = async (c: ClassRow) => {
    setBusy(true);
    const { error } = await supabase.rpc("leave_school", { _school_id: c.school_id });
    setBusy(false);
    setLeaving(null);
    if (error) { toast({ title: "Couldn't leave the class", description: "Please try again.", variant: "destructive" }); return; }
    toast({ title: `You left ${c.name}`, description: "Your teacher can no longer see any of your progress." });
    await load();
  };

  if (authLoading || !user || classes === null) return <PageLoading />;

  return (
    <div className="min-h-screen ls-cinema text-foreground">
      <PremiumHeader title="My classes" onBack={() => navigate("/discover")} icon={<GraduationCap className="h-5 w-5 text-primary" />} />
      <div className="max-w-3xl mx-auto space-y-6 px-5 py-8">
        <section className="border border-border rounded-xl p-4 space-y-2">
          <h2 className="font-semibold flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary" /> What your teacher can see</h2>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Your name and the email they invited.</li>
            <li>For each video they set as a task: how far you watched, how many times, and how green it is — counted only from when they set it.</li>
          </ul>
          <p className="text-sm font-medium pt-1">Your teacher can't see:</p>
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            <li>Any other video you watch, or what you search for.</li>
            <li>Your saved words, flashcards, streak, or when you open LinguaScript.</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-1">Videos that are tasks show a notice before you watch. Leave a class any time and your teacher loses access straight away. More in our <Link to="/privacy" className="underline">privacy policy</Link>.</p>
        </section>

        {classes.length === 0 && (
          <p className="text-muted-foreground text-sm">You're not in any class. If your teacher sent you an invite link, open it to join.</p>
        )}

        {classes.map((c) => {
          const mine = tasks.filter((t) => t.school_id === c.school_id);
          return (
            <section key={c.school_id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold">{c.name}</h2>
                <Button size="sm" variant="outline" onClick={() => setLeaving(c)}><LogOut className="w-4 h-4 mr-1" />Leave class</Button>
              </div>
              {mine.length === 0 && <p className="text-sm text-muted-foreground">No video tasks yet.</p>}
              {mine.map((t) => (
                <Link key={t.assignment_id} to={`/watch/${t.film_id}`} className="flex gap-3 items-center border border-border rounded-xl p-2 hover:border-primary/50">
                  {t.thumbnail_url
                    ? <img src={t.thumbnail_url} alt="" className="w-28 aspect-video object-cover rounded-md" />
                    : <div className="w-28 aspect-video rounded-md bg-secondary flex items-center justify-center"><Play className="w-5 h-5" /></div>}
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.title}</p>
                    {t.due_at && <p className="text-xs text-muted-foreground">Due {new Date(t.due_at).toLocaleDateString()}</p>}
                    {t.note && <p className="text-sm">{t.note}</p>}
                  </div>
                </Link>
              ))}
            </section>
          );
        })}
      </div>

      <AlertDialog open={!!leaving} onOpenChange={(o) => { if (!o && !busy) setLeaving(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {leaving?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Your teacher will stop seeing your progress on their video tasks straight away. Your own
              words and history stay in your account. To rejoin you'll need a new invite link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Stay</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); if (leaving) void leave(leaving); }}>
              {busy ? "Leaving…" : "Leave class"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
