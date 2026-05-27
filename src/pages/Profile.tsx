import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { LANGUAGES } from "@/lib/languages";
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
import { Camera, ArrowLeft, Save, Loader2, LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Profile = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [displayName, setDisplayName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [learningLanguage, setLearningLanguage] = useState("fr");
  const [school, setSchool] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [linkingGoogle, setLinkingGoogle] = useState(false);

  const hasGoogleLinked = !!user?.identities?.some((i) => i.provider === "google");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user!.id)
      .single();

    if (data) {
      setDisplayName(data.display_name ?? "");
      setAvatarUrl(data.avatar_url);
      setNativeLanguage(data.native_language ?? "en");
      setLearningLanguage(data.learning_language ?? "es");
    }
    setLoadingProfile(false);
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

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        avatar_url: avatarUrl,
        native_language: nativeLanguage,
        learning_language: learningLanguage,
      })
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

          {/* Learning Language */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Language You're Learning
            </label>
            <Select value={learningLanguage} onValueChange={setLearningLanguage}>
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.filter((l) => l.code !== nativeLanguage).map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
        </div>
      </div>
    </div>
  );
};

export default Profile;
