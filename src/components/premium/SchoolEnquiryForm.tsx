import { useState } from "react";
import { Mail, CheckCircle2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { schoolEnquirySchema } from "@/lib/schoolEnquiry";
import { track } from "@/lib/analytics";

export function SchoolEnquiryForm() {
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState<string | null>(null);
  const [error, setError] = useState("");
  return <section id="enquire" className="ls-section border-t border-border scroll-mt-24">
    <div className="grid gap-10 lg:grid-cols-2">
      <div><p className="text-xs font-semibold text-warning">YOUR SCHOOL · YOUR PRIORITIES</p>
        <h2 className="mt-4 text-3xl font-bold sm:text-4xl">See it with us.<br /><span className="text-primary">Then decide.</span></h2>
        <p className="mt-5 max-w-md text-muted-foreground">Request a walkthrough of the student experience and teacher dashboard, followed by a written school quote.</p>
        <p className="mt-4 text-sm text-muted-foreground">No payment or commitment here. Class size, access, support and price must be agreed in writing before a school purchase.</p>
        <div className="mt-7 flex items-center gap-3 text-sm"><ShieldCheck className="h-5 w-5 text-primary" /><Link to="/privacy" className="underline">Privacy and school data</Link></div>
      </div>
      {reference ? <div role="status" className="space-y-4 py-6"><CheckCircle2 className="h-10 w-10 text-primary" /><h3 className="text-2xl font-bold">Your request is received.</h3><p className="text-muted-foreground">It is saved for the LinguaScript team. We’ll use your contact email to discuss your school.</p><p className="text-xs text-muted-foreground">Reference: {reference.slice(0, 8)}</p><Button variant="outline" onClick={() => setReference(null)}>Send another request</Button></div> :
        <form className="space-y-5" onSubmit={async e => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          const count = String(form.get("students") || "");
          const parsed = schoolEnquirySchema.safeParse({ school: form.get("school"), name: form.get("name"), email: form.get("email"), students: count ? Number(count) : null, needs: form.get("needs") });
          if (!parsed.success) { setError("Please check your name, school, email and school needs (at least five characters)."); return; }
          setBusy(true); setError("");
          try {
            const d = parsed.data;
            const { data, error: issue } = await supabase.rpc("submit_school_enquiry", { _school: d.school, _name: d.name, _email: d.email, _students: d.students, _needs: d.needs });
            if (issue) throw issue;
            if (!data) throw new Error("We couldn't confirm your request was saved.");
            setReference(data); track("school_enquiry_submitted", { page: "schools" });
          } catch { setError("Your request could not be confirmed. Please try again. No payment has been taken."); }
          finally { setBusy(false); }
        }}>
          <div><Label htmlFor="school-name">School or college</Label><Input id="school-name" name="school" className="mt-2" required minLength={2} maxLength={160} autoComplete="organization" /></div>
          <div className="grid gap-5 sm:grid-cols-2"><div><Label htmlFor="school-contact">Your name</Label><Input id="school-contact" name="name" className="mt-2" required minLength={2} maxLength={100} autoComplete="name" /></div><div><Label htmlFor="school-email">Contact email</Label><Input id="school-email" name="email" type="email" className="mt-2" required maxLength={254} autoComplete="email" /></div></div>
          <div><Label htmlFor="school-learners">Approximate number of students (optional)</Label><Input id="school-learners" name="students" className="mt-2" type="number" min={1} max={100000} /></div>
          <div><Label htmlFor="school-needs">Languages and what your school needs</Label><Textarea id="school-needs" name="needs" className="mt-2" rows={4} required minLength={5} maxLength={2000} placeholder="French vocabulary, pronunciation practice, class progress…" /></div>
          <Button type="submit" size="lg" className="w-full whitespace-normal" disabled={busy}><Mail className="mr-2 h-4 w-4 shrink-0" />{busy ? "Sending your request…" : "Request a walkthrough & school quote"}</Button>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">We store these details to answer your enquiry, not enrol students or send marketing. Please don't include personal student information.</p>
        </form>}
    </div>
  </section>;
}