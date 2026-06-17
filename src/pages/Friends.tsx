import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Mail, Share2, Trophy, Users, UserPlus, Loader2, Check, X, Flame } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface LeaderRow {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  xp_total: number;
  xp_level: number;
  streak_count?: number;
  is_self: boolean;
}

interface PendingRequest {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const Friends = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [me, setMe] = useState<{ username: string | null; friend_code: string | null; show_on_global_leaderboard: boolean } | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [codeInput, setCodeInput] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [friends, setFriends] = useState<LeaderRow[]>([]);
  const [global, setGlobal] = useState<LeaderRow[]>([]);
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const inviteLink = useMemo(() => {
    if (!me?.friend_code) return "";
    return `${window.location.origin}/friends?addFriend=${me.friend_code}`;
  }, [me?.friend_code]);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth?next=/friends");
  }, [authLoading, user, navigate]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [{ data: profile }, friendsRes, globalRes, pendingRes] = await Promise.all([
      supabase.from("profiles")
        .select("username, friend_code, show_on_global_leaderboard")
        .eq("user_id", user.id)
        .maybeSingle() as any,
      (supabase.rpc as any)("get_friends_leaderboard"),
      (supabase.rpc as any)("get_global_leaderboard"),
      supabase.from("friendships")
        .select("user_id, status")
        .eq("friend_id", user.id)
        .eq("status", "pending") as any,
    ]);

    if (profile) {
      setMe(profile);
      setUsernameInput(profile.username ?? "");
    }
    if (friendsRes?.data) setFriends(friendsRes.data as LeaderRow[]);
    if (globalRes?.data) setGlobal(globalRes.data as LeaderRow[]);

    // Hydrate pending requester profiles via friends-allowed table read (requester is not yet a friend, so use RPC fallback)
    const pendingIds = (pendingRes?.data ?? []).map((r: any) => r.user_id);
    if (pendingIds.length) {
      // Best-effort: requester profile won't be readable via RLS yet; show their friend_code anonymized
      setPending(pendingIds.map((id: string) => ({ user_id: id, display_name: null, username: null, avatar_url: null })));
    } else {
      setPending([]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Auto-handle ?addFriend=CODE
  useEffect(() => {
    const code = params.get("addFriend");
    if (!code || !user) return;
    (async () => {
      const { error } = await (supabase.rpc as any)("add_friend_by_code", { _code: code });
      params.delete("addFriend");
      setParams(params, { replace: true });
      if (error) {
        toast({ title: "Couldn't add friend", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Friend request sent" });
        refresh();
      }
    })();
  }, [params, user, refresh, setParams, toast]);

  const claimUsername = async () => {
    if (!usernameInput.trim()) return;
    setWorking(true);
    const { data, error } = await (supabase.rpc as any)("set_username", { _username: usernameInput.trim() });
    setWorking(false);
    if (error) {
      const msg = error.message?.includes("taken") ? "That username is taken" :
                  error.message?.includes("invalid") ? "Use 3-24 letters, numbers or _" : error.message;
      toast({ title: "Couldn't save username", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: `Username set to @${data}` });
    refresh();
  };

  const addByCode = async () => {
    if (!codeInput.trim()) return;
    setWorking(true);
    const { error } = await (supabase.rpc as any)("add_friend_by_code", { _code: codeInput.trim() });
    setWorking(false);
    if (error) {
      const msg = error.message?.includes("unknown_code") ? "No one has that code" :
                  error.message?.includes("self") ? "That's your own code!" : error.message;
      toast({ title: "Couldn't add friend", description: msg, variant: "destructive" });
      return;
    }
    setCodeInput("");
    toast({ title: "Friend request sent" });
    refresh();
  };

  const acceptRequest = async (otherId: string) => {
    const { error } = await (supabase.rpc as any)("accept_friend_request", { _other: otherId });
    if (error) {
      toast({ title: "Couldn't accept", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Friend added" });
    refresh();
  };

  const declineRequest = async (otherId: string) => {
    await supabase.from("friendships").delete()
      .eq("user_id", otherId).eq("friend_id", user!.id) as any;
    refresh();
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    toast({ title: "Invite link copied" });
  };

  const sendEmailInvite = () => {
    if (!inviteEmail.trim() || !inviteLink) return;
    const subject = encodeURIComponent("Learn languages with me on LinguaScript");
    const body = encodeURIComponent(
      `Hey! I've been using LinguaScript to learn a new language with YouTube videos.\n\nAdd me as a friend so we can compete on the leaderboard:\n${inviteLink}\n`,
    );
    window.location.href = `mailto:${inviteEmail.trim()}?subject=${subject}&body=${body}`;
  };

  const toggleGlobal = async (val: boolean) => {
    if (!user) return;
    setMe((m) => m ? { ...m, show_on_global_leaderboard: val } : m);
    await supabase.from("profiles").update({ show_on_global_leaderboard: val } as any).eq("user_id", user.id);
    refresh();
  };

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        <Button variant="glass" onClick={() => navigate("/browse")} className="mb-6 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center">
            <Users className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Friends</h1>
            <p className="text-sm text-muted-foreground">Compete and learn together</p>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="glass-panel-strong p-4 mb-6">
            <p className="text-sm font-medium mb-3">{pending.length} pending friend request{pending.length > 1 ? "s" : ""}</p>
            <div className="space-y-2">
              {pending.map((p) => (
                <div key={p.user_id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-secondary/40">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="w-8 h-8"><AvatarFallback>?</AvatarFallback></Avatar>
                    <span className="text-sm text-muted-foreground truncate">Someone wants to be your friend</span>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="default" className="h-8 w-8" onClick={() => acceptRequest(p.user_id)}>
                      <Check className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => declineRequest(p.user_id)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="leaderboard"><Trophy className="w-4 h-4 mr-2" />Friends</TabsTrigger>
            <TabsTrigger value="add"><UserPlus className="w-4 h-4 mr-2" />Add</TabsTrigger>
            <TabsTrigger value="global"><Flame className="w-4 h-4 mr-2" />Global</TabsTrigger>
          </TabsList>

          {/* FRIENDS LEADERBOARD */}
          <TabsContent value="leaderboard" className="mt-6">
            <div className="glass-panel-strong p-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : friends.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No friends yet. Share your invite link!</p>
              ) : (
                <ol className="space-y-2">
                  {friends.map((f, i) => (
                    <LeaderboardRow key={f.user_id} row={f} rank={i + 1} showStreak />
                  ))}
                </ol>
              )}
            </div>
          </TabsContent>

          {/* ADD FRIENDS */}
          <TabsContent value="add" className="mt-6 space-y-6">
            <div className="glass-panel-strong p-6 space-y-4">
              <div>
                <p className="text-sm font-medium mb-1">Your friend code</p>
                <p className="text-xs text-muted-foreground mb-3">Share this with friends so they can add you.</p>
                <div className="flex gap-2">
                  <Input readOnly value={me?.friend_code ?? ""} className="font-mono text-lg tracking-widest text-center bg-secondary/50" />
                  <Button onClick={copyInvite} variant="outline" className="gap-2">
                    <Copy className="w-4 h-4" /> Copy link
                  </Button>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">Username</p>
                <p className="text-xs text-muted-foreground mb-3">Pick a @handle people can recognise you by.</p>
                <div className="flex gap-2">
                  <div className="flex items-center bg-secondary/50 border border-border rounded-md pl-3 flex-1">
                    <span className="text-muted-foreground">@</span>
                    <Input
                      value={usernameInput}
                      onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                      placeholder="yourname"
                      className="border-0 bg-transparent focus-visible:ring-0"
                    />
                  </div>
                  <Button onClick={claimUsername} disabled={working || !usernameInput.trim()}>Save</Button>
                </div>
              </div>
            </div>

            <div className="glass-panel-strong p-6 space-y-4">
              <p className="text-sm font-medium">Add a friend by code</p>
              <div className="flex gap-2">
                <Input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABCD1234"
                  className="font-mono tracking-widest"
                />
                <Button onClick={addByCode} disabled={working || !codeInput.trim()} className="gap-2">
                  <UserPlus className="w-4 h-4" /> Add
                </Button>
              </div>
            </div>

            <div className="glass-panel-strong p-6 space-y-4">
              <p className="text-sm font-medium">Invite by email</p>
              <p className="text-xs text-muted-foreground">Opens your mail app pre-filled with your invite link.</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="friend@example.com"
                />
                <Button onClick={sendEmailInvite} disabled={!inviteEmail.trim()} variant="outline" className="gap-2">
                  <Mail className="w-4 h-4" /> Send
                </Button>
              </div>
              <Button
                variant="ghost"
                className="w-full gap-2"
                onClick={async () => {
                  if (navigator.share && inviteLink) {
                    try { await navigator.share({ title: "LinguaScript", text: "Learn languages with me!", url: inviteLink }); } catch {}
                  } else { copyInvite(); }
                }}
              >
                <Share2 className="w-4 h-4" /> Share invite link
              </Button>
            </div>
          </TabsContent>

          {/* GLOBAL LEADERBOARD */}
          <TabsContent value="global" className="mt-6 space-y-4">
            <div className="glass-panel-strong p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Appear on global leaderboard</p>
                <p className="text-xs text-muted-foreground">Other learners can see your @username and XP.</p>
              </div>
              <Switch
                checked={me?.show_on_global_leaderboard ?? true}
                onCheckedChange={toggleGlobal}
              />
            </div>
            <div className="glass-panel-strong p-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : global.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Be the first on the board!</p>
              ) : (
                <ol className="space-y-2">
                  {global.map((g, i) => (
                    <LeaderboardRow key={g.user_id} row={g} rank={i + 1} />
                  ))}
                </ol>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

const LeaderboardRow = ({ row, rank, showStreak }: { row: LeaderRow; rank: number; showStreak?: boolean }) => {
  const name = row.username ? `@${row.username}` : (row.display_name || "Anonymous learner");
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;
  return (
    <li
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl transition-colors",
        row.is_self ? "bg-primary/10 border border-primary/30" : "bg-secondary/40 hover:bg-secondary/60",
      )}
    >
      <div className="w-10 text-center font-bold text-sm text-muted-foreground">{medal}</div>
      <Avatar className="w-10 h-10">
        <AvatarImage src={row.avatar_url ?? undefined} />
        <AvatarFallback>{name.charAt(name.startsWith("@") ? 1 : 0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {name} {row.is_self && <span className="text-xs text-primary ml-1">(you)</span>}
        </p>
        <p className="text-xs text-muted-foreground">Level {row.xp_level}</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-foreground">{row.xp_total.toLocaleString()} XP</p>
        {showStreak && row.streak_count != null && row.streak_count > 0 && (
          <p className="text-xs text-orange-500 flex items-center gap-1 justify-end">
            <Flame className="w-3 h-3" /> {row.streak_count}d
          </p>
        )}
      </div>
    </li>
  );
};

export default Friends;
