import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
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
    <div className="flex items-center gap-3">
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
          <Button variant="ghost" size="icon" onClick={signOut} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </>
      ) : (
        <Button size="sm" onClick={() => navigate("/auth")}>
          Sign In
        </Button>
      )}
    </div>
  );
};
