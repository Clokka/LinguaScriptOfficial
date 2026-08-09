import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Mail, Lock, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GOOGLE_CLIENT_ID =
  "83696703346-d088shcldb678oec73jmh3o5lqjru132.apps.googleusercontent.com";
const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ??
  "https://ffephracinqeylfhqkiz.supabase.co";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (cfg: object) => void;
          renderButton: (el: HTMLElement, opts: object) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const next = searchParams.get("next") || "/discover";
  const { toast } = useToast();

  // GIS renders into this div — the button lives here
  const googleBtnRef = useRef<HTMLDivElement>(null);
  // Keep latest closure vars accessible from GIS callback without re-initing
  const ctxRef = useRef({ inviteToken, next, navigate, toast });
  ctxRef.current = { inviteToken, next, navigate, toast };

  useEffect(() => {
    const handleCredential = async (response: { credential: string }) => {
      setGoogleLoading(true);
      const { inviteToken, next, navigate, toast } = ctxRef.current;
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/google-auth`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_token: response.credential }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Google auth failed");

        const { error: verifyErr } = await supabase.auth.verifyOtp({
          email: data.email,
          token: data.token_hash,
          type: "magiclink",
        });
        if (verifyErr) throw new Error(verifyErr.message);

        if (inviteToken) {
          const { error: inviteErr } = await supabase.rpc(
            "accept_school_invite",
            { _token: inviteToken }
          );
          if (inviteErr) toast({ title: "Invite issue", description: inviteErr.message, variant: "destructive" });
          else toast({ title: "Joined your school", description: "Welcome to the class!" });
        }

        navigate(next);
      } catch (e: any) {
        toast({ title: "Google sign-in failed", description: e.message, variant: "destructive" });
        setGoogleLoading(false);
      }
    };

    const renderBtn = () => {
      if (!window.google?.accounts?.id || !googleBtnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
        auto_select: false,
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: "outline",
        size: "large",
        width: Math.min(googleBtnRef.current.offsetWidth || 400, 400),
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
      });
    };

    // Already loaded (e.g. hot-reload)
    if (window.google?.accounts?.id) { renderBtn(); return; }

    const SCRIPT_ID = "gsi-client";
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = renderBtn;
      document.head.appendChild(s);
    } else {
      // Script tag exists but not yet executed — poll
      const iv = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(iv); renderBtn(); }
      }, 50);
      return () => clearInterval(iv);
    }
  }, []);

  const acceptInviteIfAny = async () => {
    if (!inviteToken) return;
    const { error } = await supabase.rpc("accept_school_invite", { _token: inviteToken });
    if (error) {
      toast({ title: "Invite issue", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Joined your school", description: "Welcome to the class!" });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Login failed", description: error.message, variant: "destructive" });
      } else {
        await acceptInviteIfAny();
        navigate(next);
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName },
          emailRedirectTo:
            window.location.origin +
            (inviteToken ? `/auth?invite=${inviteToken}` : "/discover"),
        },
      });
      if (error) {
        toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: "Check your email",
          description: "We sent a confirmation link to " + email + ". Click it to activate your account.",
        });
        setIsLogin(true);
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-glow-primary mx-auto mb-4">
            <Layers className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            {isLogin ? "Welcome back" : "Join LinguaScript"}
          </h1>
          <p className="text-muted-foreground mt-2">
            {isLogin ? "Sign in to continue learning" : "Create your account to start learning"}
          </p>
        </div>

        <div className="glass-panel-strong p-8 space-y-4">

          {/* Google Sign-In — GIS renders its button here */}
          <div className="w-full flex justify-center min-h-[44px] relative">
            {googleLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-md z-10">
                <span className="text-sm text-muted-foreground">Signing in…</span>
              </div>
            )}
            <div ref={googleBtnRef} className="w-full flex justify-center">
              {/* Loading placeholder — replaced by GIS iframe once script loads */}
              <div className="w-full h-[44px] rounded-md border border-border flex items-center justify-center gap-2 text-sm text-muted-foreground animate-pulse">
                <span>G</span> Loading Google Sign-In…
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Display name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="pl-10 bg-secondary/50 border-border"
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="pl-10 bg-secondary/50 border-border"
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pl-10 bg-secondary/50 border-border"
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>
        </div>

        <p className="text-center text-muted-foreground mt-6 text-sm">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline font-medium"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Auth;
