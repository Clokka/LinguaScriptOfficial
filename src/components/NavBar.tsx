import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Layers, LogOut, User, Shield } from "lucide-react";
import { StreakBadge } from "./StreakBadge";
import { LanguageSelector } from "./LanguageSelector";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export const NavBar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    if (user) {
      supabase
        .from("profiles")
        .select("avatar_url, display_name")
        .eq("user_id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setAvatarUrl(data.avatar_url);
            setDisplayName(data.display_name ?? "");
          }
        });
    }
  }, [user]);

  return (
    <header className="relative z-10 px-6 py-4">
      <nav className="max-w-7xl mx-auto flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => navigate("/")}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <Layers className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold gradient-text">Ligua Overlay</span>
        </div>

        <div className="flex items-center gap-3">
          <LanguageSelector />
          <StreakBadge streak={7} showAnimation={false} />

          <Button variant="glass" size="sm" onClick={() => navigate("/admin")} className="gap-2">
            <Shield className="w-4 h-4" />
            <span className="hidden sm:inline">Admin</span>
          </Button>

          {user ? (
            <>
              <button
                onClick={() => navigate("/profile")}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <Avatar className="w-8 h-8 border border-primary/30">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-secondary text-foreground text-xs">
                    {displayName?.charAt(0)?.toUpperCase() ?? <User className="w-3 h-3" />}
                  </AvatarFallback>
                </Avatar>
              </button>
              <Button variant="glass" size="icon" onClick={signOut}>
                <LogOut className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <Button variant="hero" size="sm" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};
