import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { LANGUAGES, getLanguageLabel } from "@/lib/languages";
import {
  startYouTubeConnect,
  captureYouTubeConnection,
  getYouTubeConnectionStatus,
  subscribeToLanguageChannels,
  YT_CONNECT_RETURN_PARAM,
  YT_CONNECT_RETURN_VALUE,
  type YouTubeConnectionStatus,
} from "@/lib/youtubeConnect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, ArrowLeft, Save, Loader2, LogOut, Check } from "lucide-react";
import { INTERESTS } from "@/lib/interests";
import { useToast } from "@/hooks/use-toast";
import { MyLanguagesPanel } from "@/components/MyLanguagesPanel";
import { PetGallery } from "@/components/pets/PetGallery";
import { usePet } from "@/contexts/PetContext";
import { getPetById } from "@/lib/pets";
import { PetViewer } from "@/components/pets/PetViewer";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/useSubscription";
import { ManageBillingButton } from "@/components/ManageBillingButton";

function BillingSection() {
  const navigate = useNavigate();
  const { isPro, source, expiresAt, cancelAtPeriodEnd, hasBillingAccount, isLifetime, loading } = useSubscription();
  if (loading) return null;
  return (
    <div className="pt-4 border-t border-border/50">
      <p className="text-sm font-medium text-foreground mb-1">Your plan</p>
      <p className="text-xs text-muted-foreground mb-3">
        {!isPro
          ? "You're on the free plan."
          : isLifetime
            ? source === "admin_grant"
              ? "Pro — gifted to you, with no expiry."
              : "Pro — lifetime access, nothing to renew."
            : cancelAtPeriodEnd
              ? `Pro — access ends ${expiresAt ? new Date(expiresAt).toLocaleDateString() : "at the end of this billing period"}.`
              : `Pro — renews ${expiresAt ? new Date(expiresAt).toLocaleDateString() : "automatically"}.`}
      </p>
      {isPro && hasBillingAccount ? (
        <ManageBillingButton className="border-border text-foreground" />
      ) : !isPro ? (
        <Button type="button" variant="outline" size="lg" className="w-full bg-background/60" onClick={() => navigate("/upgrade")}>
          See Pro plans
        </Button>
      ) : null}
    </div>
  );
}

const Profile = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [learningLanguage, setLearningLanguage] = useState("");
  const [school, setSchool] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [linkingGoogle, setLinkingGoogle] = useState(false);
  const [showPetGallery, setShowPetGallery] = useState(false);
  const { activePet, petCollection } = usePet();
  const activePetMeta = activePet ? getPetById(activePet) : null;
  const [interests, setInterests] = useState<string[]>([]);
  // The active learning language can change from the "Switch" button inside
  // MyLanguagesPanel below (a context write), not just this page's own
  // fetch-on-mount — without this sync, clicking Save Changes afterward
  // would write the STALE pre-switch language straight back over it.
  const { learningLanguage: activeLearningLanguage } = useLanguage();
  useEffect(() => {
    if (activeLearningLanguage) setLearningLanguage(activeLearningLanguage);
  }, [activeLearningLanguage]);
  const [ytStatus, setYtStatus] = useState<YouTubeConnectionStatus>({ connected: false, connectedAt: null, channelCount: 0 });
  const [ytConnecting, setYtConnecting] = useState(false);
  const [ytSubscribing, setYtSubscribing] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const hasGoogleLinked = !!user?.identities?.some((i) => i.provider === "google");

  const GUEST_KEY = "ls.guestProfile.v1";

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchProfile();
    } else {
      // Guest mode: load local prefs, no forced sign-in.
      try {
        const raw = localStorage.getItem(GUEST_KEY);
        if (raw) {
          const g = JSON.parse(raw);
          setDisplayName(g.displayName ?? "");
          setNativeLanguage(g.nativeLanguage ?? "en");
          setLearningLanguage(g.learningLanguage ?? "");
          setSchool(g.school ?? "");
          setInterests(Array.isArray(g.interests) ? g.interests : []);
        }
      } catch { /* ignore */ }
      setLoadingProfile(false);
    }
  }, [authLoading, user]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single();

    if (data) {
      setDisplayName(data.display_name ?? "");
      setAvatarUrl(data.avatar_url);
      setNativeLanguage(data.native_language ?? "en");
      setLearningLanguage(data.learning_language ?? "");
      setSchool((data as any).school ?? "");
      setInterests(Array.isArray((data as any).interests) ? (data as any).interests : []);
      setIsPublic(!!(data as any).is_public);
    }
    setLoadingProfile(false);
  };

  // Landing back from the YouTube OAuth round trip: capture the provider
  // token this specific redirect carries (Supabase doesn't persist it) and
  // kick off the actual channel subscriptions right away, so "Connect" is
  // one action for the learner, not connect-then-remember-to-subscribe.
  useEffect(() => {
    if (!user || searchParams.get(YT_CONNECT_RETURN_PARAM) !== YT_CONNECT_RETURN_VALUE) return;
    setSearchParams((p) => { p.delete(YT_CONNECT_RETURN_PARAM); return p; }, { replace: true });
    void (async () => {
      const captured = await captureYouTubeConnection();
      if (!captured.ok) {
        toast({ title: "YouTube connection failed", description: captured.error, variant: "destructive" });
        return;
      }
      toast({ title: "YouTube connected!" });
      setYtStatus(await getYouTubeConnectionStatus());
      if (learningLanguage) await runYoutubeSubscribe();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, searchParams]);

  useEffect(() => {
    if (!user) return;
    void getYouTubeConnectionStatus().then(setYtStatus);
  }, [user]);

  const handleConnectYoutube = async () => {
    setYtConnecting(true);
    const { error } = await startYouTubeConnect(hasGoogleLinked);
    if (error) {
      toast({ title: "Couldn't connect YouTube", description: error, variant: "destructive" });
      setYtConnecting(false);
    }
    // On success the page navigates away to Google, so nothing else to do here.
  };

  const runYoutubeSubscribe = async () => {
    if (!learningLanguage) {
      toast({ title: "Pick a learning language first", variant: "destructive" });
      return;
    }
    setYtSubscribing(true);
    const { results, errors, error } = await subscribeToLanguageChannels(learningLanguage, interests);
    setYtSubscribing(false);
    if (error) {
      toast({ title: "Couldn't subscribe channels", description: error, variant: "destructive" });
      return;
    }
    const newlySubscribed = results.filter((r) => r.subscribed).length;
    toast({
      title: newlySubscribed > 0 ? `Subscribed to ${newlySubscribed} channel${newlySubscribed === 1 ? "" : "s"}` : "Already subscribed to everything",
      description: errors.length > 0 ? `${errors.length} couldn't be resolved — try again later.` : undefined,
    });
    setYtStatus(await getYouTubeConnectionStatus());
  };

  const handleLinkGoogle = async () => {
    setLinkingGoogle(true);
    const { error } = await (supabase.auth as any).linkIdentity({
      provider: "google",
      options: { redirectTo: window.location.origin + "/profile" },
    });
    if (error) {
      toast({ title: "Couldn't link Google", description: error.message, variant: "destructive" });
      setLinkingGoogle(false);
    }
  };


  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${user.id}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);
    setAvatarUrl(publicUrl);
    setUploading(false);
  };

  const toggleInterest = (id: string) => {
    setInterests((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = async () => {
    setSaving(true);

    if (!user) {
      // Guest: save locally only.
      try {
        localStorage.setItem(
          GUEST_KEY,
          JSON.stringify({ displayName, nativeLanguage, learningLanguage, school: school.trim(), interests }),
        );
        toast({ title: "Saved locally", description: "Sign in to sync across devices." });
      } catch (e: any) {
        toast({ title: "Save failed", description: e.message, variant: "destructive" });
      }
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        avatar_url: avatarUrl,
        native_language: nativeLanguage,
        // Never write an empty/unknown language back over a real choice.
        ...(learningLanguage ? { learning_language: learningLanguage } : {}),
        school: school.trim() || null,
        interests,
        is_public: isPublic,
      } as any)
      .eq("user_id", user.id);

    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated!" });
    }
    setSaving(false);
  };

  if (authLoading || loadingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />
      <div className="relative z-10 max-w-xl mx-auto px-6 py-12">
        <Button variant="glass" onClick={() => navigate("/")} className="mb-8 gap-2">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>

        <h1 className="text-3xl font-bold text-foreground mb-8">Your Profile</h1>

        <div className="glass-panel-strong p-8 space-y-8">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <div className="relative group">
              <Avatar className="w-20 h-20 border-2 border-primary/30">
                <AvatarImage src={avatarUrl ?? undefined} />
                <AvatarFallback className="bg-secondary text-foreground text-xl">
                  {displayName?.charAt(0)?.toUpperCase() ?? "?"}
                </AvatarFallback>
              </Avatar>
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                ) : (
                  <Camera className="w-5 h-5 text-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            <div>
              <p className="text-foreground font-medium">{displayName || "Your Name"}</p>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="bg-secondary/50 border-border"
            />
          </div>

          {/* Native Language */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Your Native Language
            </label>
            <Select value={nativeLanguage} onValueChange={setNativeLanguage}>
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Languages you're learning (up to 5, each with its own mode) */}
          <MyLanguagesPanel nativeLanguage={nativeLanguage} />

          {/* Hobbies — drives the "Because you like X" rails and interest-matched
              YouTube channel subscriptions, so changing these reshapes the feed. */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-medium text-foreground mb-1">Your hobbies</p>
            <p className="text-xs text-muted-foreground mb-3">
              Powers your personalized video recommendations. Pick what you actually enjoy watching.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {INTERESTS.map((interest) => {
                const active = interests.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={cn(
                      "relative rounded-xl border px-3 py-2.5 flex items-center gap-2 text-sm transition-colors text-left",
                      active
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-border hover:text-foreground",
                    )}
                  >
                    <span>{interest.emoji}</span>
                    <span className="truncate">{interest.label}</span>
                    {active && <Check className="w-3.5 h-3.5 text-primary ml-auto shrink-0" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {interests.length === 0 ? "Pick at least one." : `${interests.length} selected — saved with the button below.`}
            </p>
          </div>

          {/* Privacy */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-medium text-foreground mb-3">Privacy</p>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-foreground">Public account</p>
                <p className="text-xs text-muted-foreground mt-0.5">Allow others to view your profile and stats.</p>
              </div>
              <Switch checked={isPublic} onCheckedChange={setIsPublic} />
            </div>
          </div>

          {/* School */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              School <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="e.g. Truro College"
              className="bg-secondary/50 border-border"
            />
          </div>

          <Button
            variant="hero"
            size="lg"
            className="w-full gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </Button>

          {/* My Pet */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-medium text-foreground mb-3">🐾 My Pet</p>
            <button
              onClick={() => setShowPetGallery(true)}
              className="w-full rounded-xl border border-border/50 bg-secondary/30 hover:bg-secondary/60 transition-all p-4 flex items-center gap-4 text-left group"
            >
              {activePetMeta ? (
                <div className="w-16 h-16 rounded-full overflow-hidden border border-primary/20 bg-background/30 flex-shrink-0">
                  <PetViewer glbFile={activePetMeta.glbFile} animation="Idle" size={64} />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center text-2xl flex-shrink-0">
                  🐾
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">
                  {activePetMeta ? activePetMeta.name : "Choose a companion"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {activePetMeta
                    ? `${petCollection.length} pet${petCollection.length !== 1 ? "s" : ""} in collection`
                    : "Select a pet to travel with you"}
                </p>
              </div>
              <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">
                View all →
              </span>
            </button>
          </div>

          {/* Account / Linked sign-in */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-sm font-medium text-foreground mb-1">Account</p>
            {!user ? (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  You're browsing as a guest. Sign in to sync your profile, XP and flashcards across devices.
                </p>
                <Button
                  type="button"
                  variant="hero"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate("/auth")}
                >
                  Sign in / Create account
                </Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-3">
                  {hasGoogleLinked
                    ? "Your Google account is linked — you can sign in with Google."
                    : "Link Google to sign in faster next time."}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full gap-3 bg-background/60"
                  onClick={handleLinkGoogle}
                  disabled={hasGoogleLinked || linkingGoogle}
                >
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.3 29.2 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
                    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12.5 24 12.5c2.9 0 5.5 1.1 7.5 2.8l5.7-5.7C33.6 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 43.5c5 0 9.5-1.7 13-4.6l-6-5.1c-1.9 1.4-4.3 2.2-7 2.2-5.2 0-9.6-3.2-11.3-7.6L6 33.6C9.4 39.3 16.1 43.5 24 43.5z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.3 5.5l6 5.1C40.7 35.7 43.5 30.3 43.5 24c0-1.2-.1-2.3-.4-3.5z"/>
                  </svg>
                  {hasGoogleLinked ? "Google linked" : linkingGoogle ? "Connecting…" : "Link Google account"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full gap-2 mt-3 border-destructive/40 text-destructive hover:bg-destructive/10"
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Log out
                </Button>
              </>
            )}
          </div>

          {user && (
            <div className="pt-4 border-t border-border/50">
              <p className="text-sm font-medium text-foreground mb-1">YouTube</p>
              <p className="text-xs text-muted-foreground mb-3">
                {ytStatus.connected
                  ? `Connected — subscribed to ${ytStatus.channelCount} ${learningLanguage ? getLanguageLabel(learningLanguage) : ""} channel${ytStatus.channelCount === 1 ? "" : "s"}.`
                  : "Connect your YouTube account and we'll subscribe you to real channels in your learning language — a few core language-learning ones, plus one matched to each hobby you picked (a German cars channel for a German learner into cars)."}
              </p>
              {!ytStatus.connected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full bg-background/60"
                  onClick={handleConnectYoutube}
                  disabled={ytConnecting}
                >
                  {ytConnecting ? "Connecting…" : "Connect YouTube"}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full bg-background/60"
                  onClick={runYoutubeSubscribe}
                  disabled={ytSubscribing}
                >
                  {ytSubscribing ? "Subscribing…" : "Refresh channel subscriptions"}
                </Button>
              )}
            </div>
          )}

          <BillingSection />
        </div>

      </div>
    </div>

    <PetGallery open={showPetGallery} onClose={() => setShowPetGallery(false)} />
    </>
  );
};

export default Profile;
