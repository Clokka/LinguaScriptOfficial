import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Search,
  Home,
  Compass,
  Library,
  Calendar as CalendarIcon,
  Settings,
  Link as LinkIcon,
  Loader2,
  Trash2,
  Clock,
  Flame,
  Languages,
  Download,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTour } from "@/contexts/TourContext";
import { useToast } from "@/hooks/use-toast";
import { getLanguageLabel, getLanguageFlag, LANGUAGES } from "@/lib/languages";
import { ensureSubtitleTracks } from "@/lib/subtitleSync";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { ProgressDashboard } from "@/components/ProgressDashboard";

interface UserLesson {
  id: string;
  youtube_id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  original_language: string;
  progress_percent: number;
  last_watched_at: string;
  created_at: string;
}

interface ActivityDay {
  date: string;
  minutes_watched: number;
  videos_watched: number;
}

type TabKey = "home" | "discover" | "calendar" | "settings";

const SIDEBAR_ITEMS: { icon: typeof Home; label: string; key: TabKey | "flashcards" }[] = [
  { icon: Home, label: "Home", key: "home" },
  { icon: Compass, label: "Discover", key: "discover" },
  { icon: BookOpen, label: "Flashcards", key: "flashcards" },
  { icon: CalendarIcon, label: "Calendar", key: "calendar" },
  { icon: Settings, label: "Settings", key: "settings" },
];

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([^&?\s#]+)/);
  return match ? match[1] : null;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const Browse = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { learningLanguage, setLearningLanguage } = useLanguage();
  const { toast } = useToast();
  const tour = useTour();

  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [lessons, setLessons] = useState<UserLesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [pasteUrl, setPasteUrl] = useState("");
  const [creating, setCreating] = useState(false);

  // Settings state
  const [nativeLanguage, setNativeLanguage] = useState("en");
  const [settingsLearning, setSettingsLearning] = useState(learningLanguage);
  const [displayName, setDisplayName] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Calendar state
  const [activityData, setActivityData] = useState<ActivityDay[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);

  // Discover - public films + curated rows
  const [discoverFilms, setDiscoverFilms] = useState<any[]>([]);
  const [catalogRows, setCatalogRows] = useState<{ id: string; title: string; films: any[] }[]>([]);

  const fetchLessons = useCallback(async () => {
    if (!user) { setLoadingLessons(false); return; }
    const { data } = await supabase
      .from("user_lessons")
      .select("*")
      .eq("user_id", user.id)
      .order("last_watched_at", { ascending: false });
    setLessons((data as UserLesson[]) || []);
    setLoadingLessons(false);
  }, [user]);

  const fetchActivity = useCallback(async () => {
    if (!user) return;
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data } = await supabase
      .from("activity_log")
      .select("date, minutes_watched, videos_watched")
      .eq("user_id", user.id)
      .gte("date", thirtyDaysAgo.toISOString().split("T")[0])
      .order("date", { ascending: false });
    setActivityData((data as ActivityDay[]) || []);

    // Calculate streak
    let streak = 0;
    const today = new Date();
    const dates = new Set((data || []).map((d: any) => d.date));
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      if (dates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    setCurrentStreak(streak);
  }, [user]);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (data) {
      setNativeLanguage(data.native_language || "en");
      setSettingsLearning(data.learning_language || "fr");
      setDisplayName(data.display_name || "");
      setIsPublic(!!(data as any).is_public);
    }
  }, [user]);

  useEffect(() => {
    fetchLessons();
    fetchActivity();
    fetchProfile();
    // Public films only (RLS now also enforces this)
    supabase.from("films").select("*").eq("is_public", true).order("created_at", { ascending: false }).then(({ data }) => {
      setDiscoverFilms(data || []);
    });
    // Curated catalog rows with their pinned films — filter to user's learning language (or global rows where language IS NULL)
    (async () => {
      const { data: rows } = await supabase
        .from("catalog_rows")
        .select("*")
        .or(`language.is.null,language.eq.${learningLanguage}`)
        .order("sort_order");
      if (!rows) return;
      const withFilms = await Promise.all(
        rows.map(async (row: any) => {
          const { data: pins } = await supabase
            .from("catalog_row_films")
            .select("sort_order, films(*)")
            .eq("row_id", row.id)
            .order("sort_order");
          const films = (pins || [])
            .map((p: any) => p.films)
            .filter((f: any) => f && f.is_public);
          return { id: row.id, title: row.title, films };
        })
      );
      setCatalogRows(withFilms.filter((r) => r.films.length > 0));
    })();
  }, [fetchLessons, fetchActivity, fetchProfile, learningLanguage]);

  const createLesson = async () => {
    if (!user) {
      toast({ title: "Sign in required", description: "Please sign in to save lessons.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    const ytId = getYouTubeId(pasteUrl);
    if (!ytId) {
      toast({ title: "Invalid URL", description: "Please paste a valid YouTube URL.", variant: "destructive" });
      return;
    }

    setCreating(true);

    try {
      // Fetch video info via oEmbed (no API key needed)
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
      let title = "YouTube Video";
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = oembedData.title || title;
      }

      const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;

      // Check if lesson already exists
      const { data: existing } = await supabase
        .from("user_lessons")
        .select("id")
        .eq("user_id", user.id)
        .eq("youtube_id", ytId)
        .maybeSingle();

      if (existing) {
        toast({ title: "Already saved!", description: "This video is already in your library." });
        setPasteUrl("");
        setCreating(false);
        return;
      }

      // Create a private films row owned by this user (needed for subtitle FK)
      const filmUrl = `https://www.youtube.com/watch?v=${ytId}`;
      const { data: existingFilm } = await supabase
        .from("films")
        .select("id")
        .eq("url", filmUrl)
        .eq("created_by", user.id)
        .maybeSingle();
      let filmId: string;
      if (existingFilm) {
        filmId = existingFilm.id;
      } else {
        const { data: newFilm } = await supabase.from("films").insert({
          title,
          url: filmUrl,
          thumbnail_url: thumbnail,
          language: learningLanguage,
          is_public: false,
          created_by: user.id,
        }).select("id").single();
        filmId = newFilm?.id || "";
      }

      // Create user lesson
      await supabase.from("user_lessons").insert({
        user_id: user.id,
        youtube_id: ytId,
        title,
        thumbnail_url: thumbnail,
        original_language: learningLanguage,
      });

      if (filmId) {
        // Fire-and-forget: caption ingestion runs in the background while the
        // user is already on the Watch page seeing the thumbnail/title and
        // can start the video immediately.
        ensureSubtitleTracks({
          filmId,
          videoId: ytId,
          primaryLanguage: learningLanguage,
          secondaryLanguage: nativeLanguage,
        }).catch((err) => console.warn("Background caption ingest failed:", err));
      }

      // Log activity
      const today = new Date().toISOString().split("T")[0];
      const { data: existingActivity } = await supabase
        .from("activity_log")
        .select("id, videos_watched")
        .eq("user_id", user.id)
        .eq("date", today)
        .maybeSingle();

      if (existingActivity) {
        await supabase.from("activity_log")
          .update({ videos_watched: (existingActivity.videos_watched || 0) + 1 })
          .eq("id", existingActivity.id);
      } else {
        await supabase.from("activity_log").insert({
          user_id: user.id,
          date: today,
          videos_watched: 1,
          minutes_watched: 0,
        });
      }

      toast({ title: "Lesson created! 🎬", description: `"${title}" — captions loading in the background.` });
      setPasteUrl("");
      fetchLessons();
      fetchActivity();

      // Navigate to watch immediately — captions stream in while video is ready.
      if (filmId) {
        navigate(`/watch/${filmId}`);
      }
    } catch (err: any) {
      toast({ title: "Error creating lesson", description: err.message, variant: "destructive" });
    }
    setCreating(false);
  };

  const deleteLesson = async (lessonId: string) => {
    await supabase.from("user_lessons").delete().eq("id", lessonId);
    fetchLessons();
    toast({ title: "Lesson removed" });
  };

  const saveSettings = async () => {
    if (!user) return;
    setSavingSettings(true);
    await supabase.from("profiles").update({
      native_language: nativeLanguage,
      learning_language: settingsLearning,
      display_name: displayName,
      is_public: isPublic,
    } as any).eq("user_id", user.id);
    setLearningLanguage(settingsLearning);
    toast({ title: "Settings saved!" });
    setSavingSettings(false);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 bg-card border-r border-border py-6 shrink-0">
        <button onClick={() => navigate("/")} className="flex items-center gap-3 px-5 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <Languages className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-bold gradient-text">LinguaScript</span>
        </button>

        <nav className="flex flex-col gap-1 px-3 flex-1">
          {SIDEBAR_ITEMS.map(({ icon: Icon, label, key }) => (
            <button
              key={key}
              data-tour={`nav-${key}`}
              onClick={() => key === "flashcards" ? navigate("/flashcards") : setActiveTab(key as TabKey)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeTab === key
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        {currentStreak > 0 && (
          <div className="mx-3 mt-auto p-3 rounded-xl bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2 text-accent">
              <Flame className="w-5 h-5" />
              <span className="font-bold text-sm">{currentStreak} day streak!</span>
            </div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
            {/* Mobile tabs */}
            <div className="flex md:hidden gap-1">
              {SIDEBAR_ITEMS.map(({ icon: Icon, key }) => (
                <button
                  key={key}
                  onClick={() => key === "flashcards" ? navigate("/flashcards") : setActiveTab(key as TabKey)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    activeTab === key ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              {user ? (
                <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="text-muted-foreground">
                  Profile
                </Button>
              ) : (
                <Button size="sm" onClick={() => navigate("/auth")}>Sign In</Button>
              )}
            </div>
          </div>
        </header>

        <div className="px-6 py-6">
          {activeTab === "home" && (
            <HomeTab
              lessons={lessons}
              loading={loadingLessons}
              pasteUrl={pasteUrl}
              setPasteUrl={setPasteUrl}
              creating={creating}
              createLesson={createLesson}
              deleteLesson={deleteLesson}
              navigate={navigate}
              discoverFilms={discoverFilms}
              catalogRows={catalogRows}
            />
          )}
          {activeTab === "discover" && (
            <DiscoverTab
              films={discoverFilms}
              navigate={navigate}
              learningLanguage={learningLanguage}
              onPickVideo={(url) => { setPasteUrl(url); setActiveTab("home"); }}
            />
          )}
          {activeTab === "calendar" && (
            <div className="max-w-4xl">
              <div className="mb-6">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-1">Your progress</h2>
                <p className="text-muted-foreground text-sm">Streak, memory strength, and daily compounding input.</p>
              </div>
              <ProgressDashboard />
            </div>
          )}
          {activeTab === "settings" && (
            <SettingsTab
              nativeLanguage={nativeLanguage}
              setNativeLanguage={(v) => {
                setNativeLanguage(v);
                if (tour.active && tour.step?.id === "settings-native") {
                  setTimeout(() => tour.advance(), 350);
                }
              }}
              learningLanguage={settingsLearning}
              setLearningLanguage={(v) => {
                setSettingsLearning(v);
                if (tour.active && tour.step?.id === "settings-learning") {
                  setTimeout(() => tour.advance(), 350);
                }
              }}
              displayName={displayName}
              setDisplayName={setDisplayName}
              isPublic={isPublic}
              setIsPublic={setIsPublic}
              saving={savingSettings}
              onSave={saveSettings}
              user={user}
              navigate={navigate}
            />
          )}
        </div>
      </main>
    </div>
  );
};

/* ── CATALOG ROW STRIP ── */
const CatalogStrip = ({ title, films, navigate }: { title: string; films: any[]; navigate: (p: string) => void }) => (
  <section>
    <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
      {films.map((film) => (
        <button
          key={film.id}
          onClick={() => navigate(`/watch/${film.id}`)}
          className="group shrink-0 w-[180px]"
        >
          <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
            {film.thumbnail_url ? (
              <img src={film.thumbnail_url} alt={film.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
                <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
              </div>
            </div>
          </div>
          <p className="text-sm text-foreground truncate text-left">{film.title}</p>
          <p className="text-xs text-muted-foreground text-left">{getLanguageFlag(film.language ?? "fr")} {getLanguageLabel(film.language ?? "fr")}</p>
        </button>
      ))}
    </div>
  </section>
);

/* ── HOME TAB ── */
const HomeTab = ({
  lessons, loading, pasteUrl, setPasteUrl, creating, createLesson, deleteLesson, navigate, discoverFilms, catalogRows,
}: {
  lessons: UserLesson[];
  loading: boolean;
  pasteUrl: string;
  setPasteUrl: (v: string) => void;
  creating: boolean;
  createLesson: () => void;
  deleteLesson: (id: string) => void;
  navigate: (path: string) => void;
  discoverFilms: any[];
  catalogRows: { id: string; title: string; films: any[] }[];
}) => (
  <div className="space-y-8">
    {/* Paste YouTube Link */}
    <div className="glass-panel-strong p-6 rounded-2xl">
      <h2 className="text-lg font-bold text-foreground mb-1">Paste a YouTube Link</h2>
       <p className="text-sm text-muted-foreground mb-4">
         We'll fetch the source and learning-language subtitle tracks, save them, and create an interactive lesson.
      </p>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-tour="paste-input"
            placeholder="https://youtube.com/watch?v=..."
            value={pasteUrl}
            onChange={(e) => setPasteUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createLesson()}
            className="pl-10 h-12 bg-secondary/50 border-border rounded-xl"
          />
        </div>
        <Button
          onClick={createLesson}
          disabled={creating || !pasteUrl.trim()}
          className="h-12 px-6 rounded-xl bg-gradient-to-r from-primary to-[hsl(280,100%,60%)] text-primary-foreground font-semibold gap-2"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Create Lesson
        </Button>
      </div>
    </div>

    {/* Saved Lessons */}
    <section>
      <h2 className="text-lg font-semibold text-foreground mb-4">Your Lessons</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : lessons.length === 0 ? (
        <div className="glass-panel p-12 text-center rounded-2xl">
          <Play className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No lessons yet. Paste a YouTube link above to start!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} onDelete={deleteLesson} navigate={navigate} />
          ))}
        </div>
      )}
    </section>



    {/* Curated catalog rows */}
    {catalogRows.map((row) => (
      <CatalogStrip key={row.id} title={row.title} films={row.films} navigate={navigate} />
    ))}

    {/* Generic catalog row (fallback if no curated rows) */}
    {catalogRows.length === 0 && discoverFilms.length > 0 && (
      <CatalogStrip title="From the Catalog" films={discoverFilms} navigate={navigate} />
    )}
  </div>
);

/* ── LESSON CARD ── */
const LessonCard = ({
  lesson, onDelete, navigate,
}: {
  lesson: UserLesson;
  onDelete: (id: string) => void;
  navigate: (path: string) => void;
}) => {
  // Find film by youtube_id (RLS limits to public + owned-by-me)
  const handleClick = async () => {
    const filmUrl = `https://www.youtube.com/watch?v=${lesson.youtube_id}`;
    const { data } = await supabase.from("films").select("id").eq("url", filmUrl).limit(1).maybeSingle();
    if (data) navigate(`/watch/${data.id}`);
  };

  const lastWatched = new Date(lesson.last_watched_at);
  const timeAgo = getTimeAgo(lastWatched);

  return (
    <div className="group relative">
      <button onClick={handleClick} className="w-full text-left">
        <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
          {lesson.thumbnail_url ? (
            <img src={lesson.thumbnail_url} alt={lesson.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
          )}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center shadow-glow-primary">
              <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
            </div>
          </div>
          {lesson.progress_percent > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted">
              <div className="h-full bg-primary" style={{ width: `${lesson.progress_percent}%` }} />
            </div>
          )}
        </div>
        <p className="text-sm text-foreground truncate font-medium">{lesson.title}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <Clock className="w-3 h-3" />
          <span>{timeAgo}</span>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(lesson.id); }}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 text-white/60 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

/* ── DISCOVER TAB ── */
const DiscoverTab = ({
  films, navigate, learningLanguage, onPickVideo,
}: {
  films: any[];
  navigate: (p: string) => void;
  learningLanguage: string;
  onPickVideo: (url: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const { toast } = useToast();

  const runSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("youtube-search", {
        body: { q: query, lang: learningLanguage },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResults((data as any)?.items || []);
    } catch (e: any) {
      toast({ title: "Search failed", description: e.message || String(e), variant: "destructive" });
    }
    setSearching(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Discover</h2>
        <p className="text-muted-foreground">Search YouTube or browse the curated catalog.</p>
      </div>

      {/* YouTube search */}
      <div className="glass-panel-strong p-4 rounded-2xl">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={`Search YouTube in ${getLanguageLabel(learningLanguage)}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              className="pl-10 h-11 bg-secondary/50 border-border rounded-xl"
            />
          </div>
          <Button onClick={runSearch} disabled={searching || !query.trim()} className="h-11 px-5 rounded-xl">
            {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : "Search"}
          </Button>
        </div>
      </div>

      {results.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">YouTube results</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {results.map((r) => (
              <button
                key={r.videoId}
                onClick={() => onPickVideo(`https://www.youtube.com/watch?v=${r.videoId}`)}
                className="group text-left"
              >
                <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
                  {r.thumbnail && <img src={r.thumbnail} alt={r.title} className="w-full h-full object-cover" />}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-primary/90 flex items-center justify-center">
                      <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
                    </div>
                  </div>
                </div>
                <p className="text-sm text-foreground truncate font-medium" dangerouslySetInnerHTML={{ __html: r.title }} />
                <p className="text-xs text-muted-foreground truncate">{r.channel}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Curated catalog */}
      <section>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">From the catalog</h3>
        {films.length === 0 ? (
          <div className="glass-panel p-12 text-center rounded-2xl">
            <Compass className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No catalog content yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {films.map((film) => (
              <button key={film.id} onClick={() => navigate(`/watch/${film.id}`)} className="group text-left">
                <div className="relative rounded-xl overflow-hidden aspect-video bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all">
                  {film.thumbnail_url ? (
                    <img src={film.thumbnail_url} alt={film.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><Play className="w-8 h-8 text-muted-foreground" /></div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur text-xs px-2 py-0.5 rounded-md text-foreground">
                    {getLanguageFlag(film.language ?? "fr")}
                  </div>
                </div>
                <p className="text-sm text-foreground truncate font-medium">{film.title}</p>
                <p className="text-xs text-muted-foreground">{getLanguageLabel(film.language ?? "fr")}</p>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

/* ── CALENDAR TAB ── */
const CalendarTab = ({
  activityData, streak, totalMinutes, totalVideos,
}: {
  activityData: ActivityDay[];
  streak: number;
  totalMinutes: number;
  totalVideos: number;
}) => {
  // Generate last 30 days
  const days: { date: string; active: boolean; minutes: number }[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const activity = activityData.find((a) => a.date === dateStr);
    days.push({
      date: dateStr,
      active: !!activity,
      minutes: activity?.minutes_watched || 0,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground mb-2">Activity Calendar</h2>
        <p className="text-muted-foreground">Track your daily learning progress.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-panel-strong p-5 rounded-2xl text-center">
          <Flame className="w-8 h-8 text-accent mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{streak}</p>
          <p className="text-xs text-muted-foreground">Day Streak</p>
        </div>
        <div className="glass-panel-strong p-5 rounded-2xl text-center">
          <Clock className="w-8 h-8 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{totalMinutes}</p>
          <p className="text-xs text-muted-foreground">Minutes Watched</p>
        </div>
        <div className="glass-panel-strong p-5 rounded-2xl text-center">
          <Play className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{totalVideos}</p>
          <p className="text-xs text-muted-foreground">Videos Watched</p>
        </div>
      </div>

      {/* Streak message */}
      {streak > 0 && (
        <div className="glass-panel p-4 rounded-2xl border-accent/30 bg-accent/5 text-center">
          <p className="text-accent font-semibold">
            🔥 You've used LinguaScript {streak} day{streak !== 1 ? "s" : ""} in a row!
          </p>
        </div>
      )}

      {/* Calendar grid */}
      <div className="glass-panel-strong p-6 rounded-2xl">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Last 30 Days</h3>
        <div className="grid grid-cols-7 gap-2">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <div key={day} className="text-xs text-muted-foreground text-center py-1">{day}</div>
          ))}
          {/* Pad first week */}
          {(() => {
            const firstDate = new Date(days[0].date);
            const dayOfWeek = (firstDate.getDay() + 6) % 7; // Monday = 0
            return Array.from({ length: dayOfWeek }).map((_, i) => (
              <div key={`pad-${i}`} />
            ));
          })()}
          {days.map((day) => (
            <div
              key={day.date}
              className={cn(
                "aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-colors",
                day.active
                  ? "bg-primary/20 text-primary border border-primary/30"
                  : "bg-secondary/30 text-muted-foreground/50"
              )}
              title={`${day.date}: ${day.minutes}m watched`}
            >
              {new Date(day.date).getDate()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── SETTINGS TAB ── */
const SettingsTab = ({
  nativeLanguage, setNativeLanguage,
  learningLanguage, setLearningLanguage,
  displayName, setDisplayName,
  isPublic, setIsPublic,
  saving, onSave, user, navigate,
}: {
  nativeLanguage: string;
  setNativeLanguage: (v: string) => void;
  learningLanguage: string;
  setLearningLanguage: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  saving: boolean;
  onSave: () => void;
  user: any;
  navigate: (p: string) => void;
}) => {
  if (!user) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-foreground">Settings</h2>
        <div className="rounded-3xl border border-orange-100 bg-orange-50/50 p-12 text-center">
          <p className="text-neutral-600 mb-4">Sign in to access settings.</p>
          <Button onClick={() => navigate("/auth")} className="rounded-full bg-orange-500 hover:bg-orange-600 text-white">Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-foreground mb-1">Settings</h2>
        <p className="text-muted-foreground">A friendly little control panel for your learning.</p>
      </div>

      {/* Profile */}
      <SettingsSection title="Profile" subtitle="How you appear to others.">
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">Display name</label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-xl border-orange-100 focus-visible:ring-orange-300"
          />
        </div>
      </SettingsSection>

      {/* Languages */}
      <SettingsSection title="Languages" subtitle="Powers translations and pronunciation voices.">
        <div data-tour="settings-native">
          <label className="text-sm font-medium text-foreground mb-2 block">Native language</label>
          <Select value={nativeLanguage} onValueChange={setNativeLanguage}>
            <SelectTrigger className="rounded-xl border-orange-100"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((l) => (<SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div data-tour="settings-learning">
          <label className="text-sm font-medium text-foreground mb-2 block">Learning</label>
          <Select value={learningLanguage} onValueChange={setLearningLanguage}>
            <SelectTrigger className="rounded-xl border-orange-100"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.filter((l) => l.code !== nativeLanguage).map((l) => (
                <SelectItem key={l.code} value={l.code}>{l.flag} {l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SettingsSection>

      {/* Privacy */}
      <SettingsSection title="Privacy" subtitle="Control who can see your progress.">
        <ToggleRow
          title="Public account"
          subtitle="Allow others to view your profile and stats."
          checked={isPublic}
          onChange={setIsPublic}
        />
        <ToggleRow
          title="Leaderboard"
          subtitle="Coming soon — climb the ranks against friends."
          checked={false}
          onChange={() => {}}
          disabled
          badge="Soon"
        />
      </SettingsSection>

      <Button
        onClick={onSave}
        disabled={saving}
        className="w-full h-12 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold gap-2 shadow-[0_8px_24px_-8px_rgba(249,115,22,0.5)]"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        Save settings
      </Button>
    </div>
  );
};

const SettingsSection = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <div className="rounded-3xl bg-card border border-orange-100/80 p-6 sm:p-7 space-y-5">
    <div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    {children}
  </div>
);

const ToggleRow = ({
  title, subtitle, checked, onChange, disabled, badge,
}: {
  title: string; subtitle?: string; checked: boolean; onChange: (v: boolean) => void;
  disabled?: boolean; badge?: string;
}) => (
  <div className={cn("flex items-center justify-between gap-4 py-2", disabled && "opacity-70")}>
    <div>
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {badge && <span className="text-[10px] font-semibold uppercase tracking-wider text-orange-600 bg-orange-50 border border-orange-200/70 rounded-full px-2 py-0.5">{badge}</span>}
      </div>
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    </div>
    <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
  </div>
);

/* ── Helpers ── */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

export default Browse;
