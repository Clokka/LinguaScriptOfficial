import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";

export default function CheckoutReturn() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const { isPro, refresh, loading } = useSubscription();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (isPro || tries >= 6) return;
    const t = setTimeout(() => {
      void refresh();
      setTries((n) => n + 1);
    }, 1500);
    return () => clearTimeout(t);
  }, [isPro, tries, refresh]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="glass-panel-strong max-w-md w-full p-8 rounded-3xl text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-success/15 border border-success/30 flex items-center justify-center">
          {isPro ? <Check className="w-7 h-7 text-success" /> : <Loader2 className="w-7 h-7 text-primary animate-spin" />}
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          {isPro ? <>Welcome to Pro <Sparkles className="w-5 h-5 text-amber-400" /></> : "Finalizing your payment"}
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          {isPro
            ? "Your account is now Pro. Every learning language is unlocked and your streak is safe."
            : "We're confirming your payment with our processor. This usually takes a few seconds."}
        </p>
        {!sessionId && <p className="text-xs text-muted-foreground mb-4">No session reference found.</p>}
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild variant="ghost"><Link to="/pricing">Back to plans</Link></Button>
          <Button asChild variant="hero" disabled={!isPro && loading}>
            <Link to="/discover">Start learning</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
