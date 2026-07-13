import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, ChevronRight, Clock, Flame, GraduationCap, Languages, Leaf, Loader2, Play, Search, Sparkles, Target, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLanguageFlag, getLanguageLabel, LANGUAGES } from "@/lib/languages";
import { ensureSubtitleTracks } from "@/lib/subtitleSync";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface FilmRow {
  id: string;
  title: string;
  url?: string | null;
  thumbnail_url: string | null;
  language: string | null;
  duration_seconds?: number | null;
}

interface TrailStats {
  green: number;
  orange: number;
  red: number;
}

function getYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|v\/|shorts\/))([^&?\s#]+)/);
  return match ? match[1] : null;
}

function formatDuration(seconds?: number | null): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default function Browse1() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { learningLanguage, setLearningLanguage } = useLanguage();
  const [films, setFilms] = useState<FilmRow[]>([]);
  const [featured, setFeatured] = useState<FilmRow | null>(null);
  const [stats, setStats] = useState<TrailStats>({ green: 0, orange: 0, red: 0 });
  const [streak, setStreak] = useState(0);
  const [pasteUrl, setPasteUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [loadingFilms, setLoadingFilms] = useState(true);

  const languageLabel = getLanguageLabel(learningLanguage);
  const languageFlag = getLanguageFlag(learningLanguage);
  const understoodPct = Math.min(99, Math.round((stats.green / 5000) * 100));
  const totalDeck = stats.green + stats.orange + stats.red;

  const fetchHome = useCallback(async () => {
    setLoadingFilms(true);
    const { data: publicFilms } = await supabase
      .from("films")
      .select("id, title, url, thumbnail_url, language, duration_seconds")
      .eq("is_public", true)
      .eq("language", learningLanguage)
      .order("created_at", { ascending: false })
      .limit(24);

    const visibleFilms = ((publicFilms as FilmRow[]) || []).filter(Boolean);
    setFilms(visibleFilms);
    setFeatured(visibleFilms[0] ?? null);
    setLoadingFilms(false);

    if (user) {
      const [green, orange, red, profile] = await Promise.all([
        supabase.from("saved_words").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("language", learningLanguage).eq("state", "green"),
        supabase.from("saved_words").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("language", learningLanguage).eq("state", "orange"),
        supabase.from("saved_words").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("language", learningLanguage).or("state.eq.red,state.is.null"),
        supabase.from("profiles").select("streak_count").eq("user_id", user.id).maybeSingle(),
      ]);
      setStats({ green: green.count ?? 0, orange: orange.count ?? 0, red: red.count ?? 0 });
      setStreak(Number((profile.data as any)?.streak_count || 0));
    } else {
      setStats({ green: 0, orange: 0, red: 0 });
      setStreak(0);
    }
  }, [learningLanguage, user]);

  useEffect(() => { void fetchHome(); }, [fetchHome]);

  const almostGreen = useMemo(() => films.slice(0, 6), [films]);
  const quickFilms = useMemo(() => films.filter((film) => !film.duration_seconds || film.duration_seconds <= 1800).slice(0, 6), [films]);

  const createLesson = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const ytId = getYouTubeId(pasteUrl);
    if (!ytId) {
      toast({ title: "Paste a YouTube link", description: "Use a full YouTube URL so the lesson can be prepared.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      let title = "YouTube lesson";
      try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${ytId}&format=json`);
        if (res.ok) title = ((await res.json()) as any).title || title;
      } catch { /* optional title lookup */ }

      const filmUrl = `https://www.youtube.com/watch?v=${ytId}`;
      const thumbnail = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      const { data: existingFilm } = await supabase
        .from("films")
        .select("id")
        .eq("url", filmUrl)
        .eq("created_by", user.id)
        .maybeSingle();

      let filmId = existingFilm?.id;
      if (!filmId) {
        const { data: newFilm, error } = await supabase
          .from("films")
          .insert({ title, url: filmUrl, thumbnail_url: thumbnail, language: learningLanguage, is_public: false, created_by: user.id })
          .select("id")
          .maybeSingle();
        if (error) throw error;
        filmId = newFilm?.id;
      }

      const { data: existingLesson } = await supabase
        .from("user_lessons")
        .select("id")
        .eq("user_id", user.id)
        .eq("youtube_id", ytId)
        .maybeSingle();
      if (!existingLesson) {
        await supabase.from("user_lessons").insert({ user_id: user.id, youtube_id: ytId, title, thumbnail_url: thumbnail, original_language: learningLanguage });
      }

      if (filmId) {
        ensureSubtitleTracks({ filmId, videoId: ytId, primaryLanguage: learningLanguage, secondaryLanguage: "en" }).catch(console.warn);
        navigate(`/watch/${filmId}`);
      }
    } catch (error: any) {
      toast({ title: "Couldn't create lesson", description: error.message || String(error), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="min-h-screen bg-browse-forest text-browse-forest-foreground overflow-hidden">
      <section className="relative min-h-screen bg-gradient-browse-sky">
        <div className="absolute inset-x-0 top-0 h-28 opacity-70" aria-hidden>
          <div className="h-full bg-[radial-gradient(circle_at_8%_20%,hsl(var(--browse-leaf))_0_13%,transparent_14%),radial-gradient(circle_at_23%_12%,hsl(var(--browse-canopy))_0_16%,transparent_17%),radial-gradient(circle_at_42%_18%,hsl(var(--browse-leaf))_0_14%,transparent_15%),radial-gradient(circle_at_64%_10%,hsl(var(--browse-canopy))_0_17%,transparent_18%),radial-gradient(circle_at_83%_18%,hsl(var(--browse-leaf))_0_14%,transparent_15%)]" />
        </div>

        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
          <header className="flex items-center gap-3 py-2">
            <button onClick={() => navigate("/")} className="flex items-center gap-2" aria-label="LinguaScript home">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green text-brand-green-foreground shadow-forest">
                <Leaf className="h-5 w-5" />
              </span>
              <span className="text-sm font-black tracking-tight">Lingua<span className="text-brand-green">Script</span></span>
            </button>

            <nav className="hidden items-center gap-5 text-xs font-semibold text-browse-forest-foreground/70 md:flex">
              <button onClick={() => navigate("/discover")} className="transition hover:text-browse-forest-foreground">Discover</button>
              <button onClick={() => navigate("/flashcards")} className="transition hover:text-browse-forest-foreground">Flashcards</button>
              <button onClick={() => navigate("/progress")} className="transition hover:text-browse-forest-foreground">Progress</button>
              <button onClick={() => navigate("/friends")} className="transition hover:text-browse-forest-foreground">Friends</button>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              <div className="hidden items-center gap-1 rounded-full border border-brand-green/25 bg-browse-canopy/70 px-3 py-1.5 text-xs font-semibold sm:flex">
                <Languages className="h-3.5 w-3.5 text-brand-green" />
                {languageFlag} {languageLabel}
              </div>
              {authLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : user ? (
                <Button variant="ghost" size="sm" onClick={() => navigate("/profile")} className="text-browse-forest-foreground/75 hover:text-browse-forest-foreground">Profile</Button>
              ) : (
                <Button size="sm" onClick={() => navigate("/auth")} className="bg-brand-green text-brand-green-foreground hover:bg-brand-green/90">Sign in</Button>
              )}
            </div>
          </header>

          <div className="grid flex-1 items-center gap-8 py-6 lg:grid-cols-[1.02fr_0.98fr] lg:py-10">
            <section className="space-y-6">
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-normal sm:text-5xl lg:text-6xl">
                  Pick tonight's film. Watching is the lesson.
                </h1>
                <p className="max-w-xl text-sm font-medium text-browse-forest-foreground/72 sm:text-base">
                  Your {languageLabel} canopy is {understoodPct}% green. Every film you finish grows it.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {LANGUAGES.filter((language) => ["fr", "es", "de", "it", "ja"].includes(language.code)).map((language) => (
                  <button
                    key={language.code}
                    onClick={() => setLearningLanguage(language.code)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-bold transition",
                      language.code === learningLanguage
                        ? "border-brand-green bg-brand-green text-brand-green-foreground"
                        : "border-brand-green/20 bg-browse-canopy/55 text-browse-forest-foreground/78 hover:border-brand-green/50",
                    )}
                  >
                    {language.flag} {language.label}
                  </button>
                ))}
                <button className="rounded-full border border-brand-green/20 bg-browse-canopy/55 px-3 py-1.5 text-xs font-bold text-browse-forest-foreground/78">A1–C1</button>
                <button className="rounded-full border border-brand-green/20 bg-browse-canopy/55 px-3 py-1.5 text-xs font-bold text-browse-forest-foreground/78">Under 30 min</button>
                <button className="rounded-full border border-brand-green/20 bg-browse-canopy/55 px-3 py-1.5 text-xs font-bold text-browse-forest-foreground/78">Almost green</button>
              </div>

              <div className="rounded-2xl border border-brand-green/25 bg-gradient-browse-card p-4 shadow-forest">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-brand-green">Your trail</p>
                    <h2 className="text-lg font-black">Forest floor to canopy</h2>
                  </div>
                  <div className="flex items-center gap-1 rounded-full bg-browse-forest/70 px-3 py-1 text-xs font-bold text-state-orange">
                    <Flame className="h-3.5 w-3.5" /> {streak || 0}
                  </div>
                </div>
                <div className="relative h-12 rounded-full border border-brand-green/20 bg-browse-forest/55 px-5">
                  <div className="absolute left-8 right-8 top-1/2 h-1 -translate-y-1/2 border-t border-dashed border-brand-green/35" />
                  {[0, 33, 66, understoodPct].map((point, index) => (
                    <span
                      key={`${point}-${index}`}
                      className={cn(
                        "absolute top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-[10px] font-black",
                        index === 3 ? "border-state-orange bg-state-orange text-brand-green-foreground" : "border-brand-green bg-browse-canopy text-brand-green",
                      )}
                      style={{ left: `${Math.max(7, Math.min(93, point))}%` }}
                    >
                      {index === 3 ? `${understoodPct}%` : ""}
                    </span>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-semibold text-browse-forest-foreground/72">
                  <span><span className="text-state-green">●</span> {stats.green.toLocaleString()} green</span>
                  <span><span className="text-state-orange">●</span> {stats.orange.toLocaleString()} learning</span>
                  <span><span className="text-state-red">●</span> {stats.red.toLocaleString()} new</span>
                </div>
              </div>

              <div className="rounded-2xl border border-brand-green/20 bg-browse-canopy/70 p-4 backdrop-blur-xl">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-green" />
                    <Input
                      value={pasteUrl}
                      onChange={(event) => setPasteUrl(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && void createLesson()}
                      placeholder="Paste a YouTube film or lesson link"
                      className="h-12 rounded-xl border-brand-green/20 bg-browse-forest/55 pl-10 text-browse-forest-foreground placeholder:text-browse-forest-foreground/45"
                    />
                  </div>
                  <Button onClick={createLesson} disabled={creating || !pasteUrl.trim()} className="h-12 rounded-xl bg-brand-green px-5 text-brand-green-foreground hover:bg-brand-green/90">
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                    Quick Play
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-brand-green/25 bg-gradient-browse-video p-3 shadow-forest lg:p-4">
              <button
                disabled={!featured}
                onClick={() => featured && navigate(`/watch/${featured.id}`)}
                className="group relative block aspect-video w-full overflow-hidden rounded-xl bg-browse-forest text-left disabled:cursor-default"
              >
                {featured?.thumbnail_url ? (
                  <img src={featured.thumbnail_url} alt={featured.title} className="h-full w-full object-cover opacity-82 transition duration-500 group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-browse-card">
                    {loadingFilms ? <Loader2 className="h-8 w-8 animate-spin text-brand-green" /> : <Play className="h-12 w-12 text-brand-green" />}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-browse-forest via-browse-forest/25 to-transparent" />
                <div className="absolute left-4 top-4 rounded-full bg-browse-forest/75 px-3 py-1 text-xs font-bold text-brand-green backdrop-blur">Featured path</div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full border border-brand-green/40 bg-browse-forest/70 text-brand-green backdrop-blur transition group-hover:scale-105">
                    <Play className="ml-1 h-7 w-7" />
                  </span>
                </div>
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-xs font-bold uppercase tracking-widest text-brand-green">{languageFlag} {languageLabel}</p>
                  <h2 className="mt-1 line-clamp-2 text-2xl font-black">{featured?.title || "Choose a film to start"}</h2>
                  <p className="mt-2 text-xs font-semibold text-browse-forest-foreground/72">Tap the player area to begin with subtitles and saveable words.</p>
                </div>
              </button>
            </section>
          </div>

          <section className="grid gap-5 pb-8 lg:grid-cols-[1fr_1fr]">
            <FilmRail title="Almost green" subtitle="Films where one more watch tips the canopy." films={almostGreen} loading={loadingFilms} onOpen={(id) => navigate(`/watch/${id}`)} />
            <FilmRail title="Quick lessons" subtitle="Short sessions for steady progress." films={quickFilms.length ? quickFilms : films.slice(0, 6)} loading={loadingFilms} onOpen={(id) => navigate(`/watch/${id}`)} />
          </section>

          <footer className="mb-6 rounded-2xl border border-brand-green/20 bg-browse-canopy/75 p-4 backdrop-blur-xl sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-black"><GraduationCap className="h-4 w-4 text-brand-green" /> LinguaScript for schools</p>
              <p className="mt-1 text-xs font-medium text-browse-forest-foreground/68">Bring film-based language learning to a class, department, or trust.</p>
            </div>
            <Button onClick={() => navigate("/teacher")} className="mt-4 w-full bg-brand-green text-brand-green-foreground hover:bg-brand-green/90 sm:mt-0 sm:w-auto">
              School sign up <ChevronRight className="h-4 w-4" />
            </Button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function FilmRail({ title, subtitle, films, loading, onOpen }: { title: string; subtitle: string; films: FilmRow[]; loading: boolean; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-brand-green/20 bg-browse-canopy/60 p-4 backdrop-blur-xl">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-black">{title}</h2>
          <p className="text-xs font-medium text-browse-forest-foreground/65">{subtitle}</p>
        </div>
        <Sparkles className="h-5 w-5 text-state-orange" />
      </div>
      {loading ? (
        <div className="flex h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-green" /></div>
      ) : films.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-brand-green/15 bg-browse-forest/45 text-sm text-browse-forest-foreground/60">More films are being planted here.</div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {films.map((film, index) => (
            <button key={film.id} onClick={() => onOpen(film.id)} className="group overflow-hidden rounded-xl border border-brand-green/15 bg-browse-forest/55 text-left transition hover:border-brand-green/45">
              <div className="relative aspect-video overflow-hidden bg-browse-forest">
                {film.thumbnail_url ? <img src={film.thumbnail_url} alt={film.title} className="h-full w-full object-cover opacity-80 transition group-hover:scale-105" /> : <div className="flex h-full items-center justify-center"><Play className="h-7 w-7 text-brand-green" /></div>}
                <div className="absolute right-2 top-2 rounded-full bg-browse-forest/80 px-2 py-0.5 text-[10px] font-black text-state-orange">B{index + 1}</div>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-browse-forest/80 px-2 py-0.5 text-[10px] font-bold text-browse-forest-foreground/82">
                  <Clock className="h-3 w-3 text-brand-green" /> {formatDuration(film.duration_seconds) || "Lesson"}
                </div>
              </div>
              <div className="p-3">
                <p className="line-clamp-2 text-sm font-black leading-snug">{film.title}</p>
                <div className="mt-2 flex items-center justify-between text-[11px] font-bold text-browse-forest-foreground/58">
                  <span>{getLanguageFlag(film.language || "fr")} {getLanguageLabel(film.language || "fr")}</span>
                  <span className="text-brand-green">Watch</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}