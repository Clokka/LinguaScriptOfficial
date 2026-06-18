import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Copy, Mail, MessageSquare, Share2, Trophy, Users, UserPlus, Loader2, Check, X, Flame, Inbox, Send } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
}

interface ChatMsg {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
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
  const [inbox, setInbox] = useState<ChatMsg[]>([]);
  const [unread, setUnread] = useState(0);
  const [senders, setSenders] = useState<Record<string, LeaderRow>>({});
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  // Message dialog
  const [msgTarget, setMsgTarget] = useState<LeaderRow | null>(null);
  const [msgBody, setMsgBody] = useState("");
  const [sending, setSending] = useState(false);

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
    const [{ data: profile }, friendsRes, globalRes, pendingRes, inboxRes, unreadRes] = await Promise.all([
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
      supabase.from("friend_messages" as any)
        .select("id, sender_id, recipient_id, body, created_at, read_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100) as any,
      (supabase.rpc as any)("get_unread_message_count"),
    ]);

    if (profile) {
      setMe(profile);
      setUsernameInput(profile.username ?? "");
    }
    if (friendsRes?.data) setFriends(friendsRes.data as LeaderRow[]);
    if (globalRes?.data) setGlobal(globalRes.data as LeaderRow[]);
    setPending(((pendingRes?.data ?? []) as any[]).map((r) => ({ user_id: r.user_id })));
    setInbox((inboxRes?.data ?? []) as ChatMsg[]);
    if (typeof unreadRes?.data === "number") setUnread(unreadRes.data);
    setLoading(false);
  }, [user]);

  useEffect(() => { if (user) refresh(); }, [user, refresh]);

  // Build sender lookup table from global + friends (already sanitized server-side)
  useEffect(() => {
    const map: Record<string, LeaderRow> = {};
    [...friends, ...global].forEach((r) => { map[r.user_id] = r; });
    setSenders(map);
  }, [friends, global]);

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

  const addByUserId = async (target: LeaderRow) => {
    const { error } = await (supabase.rpc as any)("add_friend_by_user_id", { _target: target.user_id });
    if (error) {
      const m = error.message ?? "";
      const desc = m.includes("self") ? "That's you!" :
                   m.includes("unknown_user") ? "User not found" : m;
      toast({ title: "Couldn't add friend", description: desc, variant: "destructive" });
      return;
    }
    toast({ title: "Friend request sent" });
    refresh();
  };

  const acceptRequest = async (otherId: string) => {
    const { error } = await (supabase.rpc as any)("accept_friend_request", { _other: otherId });
    if (error) return toast({ title: "Couldn't accept", description: error.message, variant: "destructive" });
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

  const sendMessage = async () => {
    if (!msgTarget || !msgBody.trim()) return;
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-friend-message", {
      body: { recipient_id: msgTarget.user_id, body: msgBody.trim() },
    });
    setSending(false);
    if (error || (data as any)?.error) {
      const m = (data as any)?.message || error?.message || "Couldn't send message";
      toast({ title: "Message not sent", description: m, variant: "destructive" });
      return;
    }
    toast({ title: "Message sent", description: "They'll also get an email notification." });
    setMsgTarget(null);
    setMsgBody("");
  };

  const markRead = async (msg: ChatMsg) => {
    if (msg.read_at) return;
    await supabase.from("friend_messages" as any).update({ read_at: new Date().toISOString() } as any).eq("id", msg.id);
    setInbox((arr) => arr.map((m) => m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m));
    setUnread((n) => Math.max(0, n - 1));
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
            <p className="text-sm text-muted-foreground">Compete, message and learn together</p>
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="leaderboard"><Trophy className="w-4 h-4 mr-1.5" />Friends</TabsTrigger>
            <TabsTrigger value="add"><UserPlus className="w-4 h-4 mr-1.5" />Add</TabsTrigger>
            <TabsTrigger value="global"><Flame className="w-4 h-4 mr-1.5" />Global</TabsTrigger>
            <TabsTrigger value="inbox" className="relative">
              <Inbox className="w-4 h-4 mr-1.5" />Inbox
              {unread > 0 && <Badge className="ml-1.5 h-5 px-1.5 text-[10px]" variant="destructive">{unread}</Badge>}
            </TabsTrigger>
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
                    <LeaderboardRow key={f.user_id} row={f} rank={i + 1} showStreak
                      onMessage={() => { setMsgTarget(f); setMsgBody(""); }}
                    />
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
                <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@example.com" />
                <Button onClick={sendEmailInvite} disabled={!inviteEmail.trim()} variant="outline" className="gap-2">
                  <Mail className="w-4 h-4" /> Send
                </Button>
              </div>
              <Button variant="ghost" className="w-full gap-2"
                onClick={async () => {
                  if (navigator.share && inviteLink) {
                    try { await navigator.share({ title: "LinguaScript", text: "Learn languages with me!", url: inviteLink }); } catch {}
                  } else { copyInvite(); }
                }}>
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
              <Switch checked={me?.show_on_global_leaderboard ?? true} onCheckedChange={toggleGlobal} />
            </div>
            <div className="glass-panel-strong p-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : global.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Be the first on the board!</p>
              ) : (
                <ol className="space-y-2">
                  {global.map((g, i) => (
                    <LeaderboardRow
                      key={g.user_id}
                      row={g}
                      rank={i + 1}
                      onAdd={g.is_self ? undefined : () => addByUserId(g)}
                      onMessage={g.is_self ? undefined : () => { setMsgTarget(g); setMsgBody(""); }}
                    />
                  ))}
                </ol>
              )}
            </div>
          </TabsContent>

          {/* INBOX */}
          <TabsContent value="inbox" className="mt-6">
            <div className="glass-panel-strong p-4">
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : inbox.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No messages yet.</p>
              ) : (
                <ul className="space-y-2">
                  {inbox.map((m) => {
                    const s = senders[m.sender_id];
                    const name = s ? (s.username ? `@${s.username}` : s.display_name || "A learner") : "A learner";
                    return (
                      <li
                        key={m.id}
                        onClick={() => markRead(m)}
                        className={cn(
                          "p-3 rounded-xl cursor-pointer transition-colors",
                          m.read_at ? "bg-secondary/30" : "bg-primary/10 border border-primary/30",
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="w-7 h-7"><AvatarFallback>{name.charAt(name.startsWith("@") ? 1 : 0).toUpperCase()}</AvatarFallback></Avatar>
                            <span className="text-sm font-medium truncate">{name}</span>
                            {!m.read_at && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">{new Date(m.created_at).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap pl-9">{m.body}</p>
                        <div className="flex justify-end mt-2 pl-9">
                          <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (s) { setMsgTarget(s); setMsgBody(""); }
                            }}>
                            <MessageSquare className="w-3.5 h-3.5" /> Reply
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Message dialog */}
      <Dialog open={!!msgTarget} onOpenChange={(o) => { if (!o) { setMsgTarget(null); setMsgBody(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message {msgTarget?.username ? `@${msgTarget.username}` : msgTarget?.display_name || "learner"}</DialogTitle>
            <DialogDescription>They'll also receive an email notification from hello@linguascript.xyz.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={msgBody}
            onChange={(e) => setMsgBody(e.target.value.slice(0, 500))}
            placeholder="Say hi, challenge them, share a tip…"
            rows={5}
            autoFocus
          />
          <div className="text-xs text-muted-foreground text-right">{msgBody.length}/500</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMsgTarget(null); setMsgBody(""); }}>Cancel</Button>
            <Button onClick={sendMessage} disabled={sending || !msgBody.trim()} className="gap-2">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const LeaderboardRow = ({
  row, rank, showStreak, onAdd, onMessage,
}: {
  row: LeaderRow; rank: number; showStreak?: boolean;
  onAdd?: () => void; onMessage?: () => void;
}) => {
  const name = row.username ? `@${row.username}` : (row.display_name || "Learner");
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
      <div className="text-right shrink-0">
        <p className="font-bold text-foreground">{row.xp_total.toLocaleString()} XP</p>
        {showStreak && row.streak_count != null && row.streak_count > 0 && (
          <p className="text-xs text-orange-500 flex items-center gap-1 justify-end">
            <Flame className="w-3 h-3" /> {row.streak_count}d
          </p>
        )}
      </div>
      {(onAdd || onMessage) && (
        <div className="flex gap-1 shrink-0 ml-1">
          {onMessage && (
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onMessage} title="Send message">
              <MessageSquare className="w-4 h-4" />
            </Button>
          )}
          {onAdd && (
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={onAdd} title="Add friend">
              <UserPlus className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </li>
  );
};

export default Friends;
