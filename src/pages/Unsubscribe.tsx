import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, XCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type State = "validating" | "ready" | "already" | "invalid" | "submitting" | "done" | "error";

const Unsubscribe = () => {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>("validating");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`,
          { headers: { apikey: SUPABASE_ANON } },
        );
        const j = await res.json().catch(() => ({}));
        if (!res.ok) { setState("invalid"); return; }
        if (j?.valid === false && j?.reason === "already_unsubscribed") setState("already");
        else setState("ready");
      } catch { setState("invalid"); }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON },
        body: JSON.stringify({ token }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j?.success || j?.reason === "already_unsubscribed")) setState("done");
      else setState("error");
    } catch { setState("error"); }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 glass-panel-strong p-8 max-w-md w-full text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-primary flex items-center justify-center">
          <Mail className="w-7 h-7 text-primary-foreground" />
        </div>
        {state === "validating" && (<><h1 className="text-xl font-bold">Checking your link…</h1><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></>)}
        {state === "ready" && (<>
          <h1 className="text-2xl font-bold">Unsubscribe from LinguaScript emails?</h1>
          <p className="text-sm text-muted-foreground">You won't receive friend messages or product emails at this address.</p>
          <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
        </>)}
        {state === "submitting" && (<><h1 className="text-xl font-bold">Unsubscribing…</h1><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></>)}
        {(state === "done" || state === "already") && (<>
          <CheckCircle2 className="w-10 h-10 mx-auto text-success" />
          <h1 className="text-2xl font-bold">You're unsubscribed</h1>
          <p className="text-sm text-muted-foreground">We won't email this address again.</p>
        </>)}
        {(state === "invalid" || state === "error") && (<>
          <XCircle className="w-10 h-10 mx-auto text-destructive" />
          <h1 className="text-2xl font-bold">Link not valid</h1>
          <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
        </>)}
      </div>
    </div>
  );
};

export default Unsubscribe;
