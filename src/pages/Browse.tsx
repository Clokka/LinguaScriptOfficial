import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Search,
  Home,
  Compass,
  Library,
  Calendar,
  Puzzle,
  Settings,
} from "lucide-react";
import { NavBar } from "@/components/NavBar";
import { supabase } from "@/integrations/supabase/client";
import { getLanguageLabel, getLanguageFlag } from "@/lib/languages";
import { cn } from "@/lib/utils";

interface FilmData {
  id: string;
  title: string;
  url: string;
  language: string | null;
  thumbnail_url: string | null;
}

const SIDEBAR_ITEMS = [
  { icon: Home, label: "Home" },
  { icon: Compass, label: "Discover" },
  { icon: Library, label: "Library" },
  { icon: Calendar, label: "Calendar" },
  { icon: Puzzle, label: "Addons" },
  { icon: Settings, label: "Settings" },
];

const Browse = () => {
  const navigate = useNavigate();
  const [films, setFilms] = useState<FilmData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeItem, setActiveItem] = useState("Home");

  useEffect(() => {
    supabase
      .from("films")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setFilms(data);
      });
  }, []);

  const filteredFilms = films.filter((f) =>
    f.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar with labels */}
      <aside className="hidden md:flex flex-col w-48 bg-card border-r border-border py-6 shrink-0">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 px-5 mb-6"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" />
          </div>
          <span className="text-sm font-bold gradient-text">LinguaScript</span>
        </button>

        <nav className="flex flex-col gap-1 px-3">
          {SIDEBAR_ITEMS.map(({ icon: Icon, label }) => (
            <button
              key={label}
              onClick={() => setActiveItem(label)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                activeItem === label
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between px-6 py-3">
            <h1 className="text-lg font-bold gradient-text hidden sm:block md:hidden">LinguaScript</h1>
            <div className="flex-1 max-w-lg mx-auto px-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search or paste link"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-10 pr-4 rounded-full bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>
            <NavBar />
          </div>
        </header>

        {/* Content area */}
        <div className="px-6 py-6 space-y-10">
          <CatalogRow
            title="Your Library"
            films={filteredFilms}
            onFilmClick={(film) => navigate(`/watch/${film.id}`)}
          />
          <ComingSoonRow title="Popular on LinguaScript" />
          <ComingSoonRow title="Recently Added" />
          <ComingSoonRow title="French Cinema" />
        </div>

        <footer className="px-6 py-8 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            More content coming soon — LinguaScript is in early access
          </p>
        </footer>
      </main>
    </div>
  );
};

/* ── Catalog Row ── */
const CatalogRow = ({
  title,
  films,
  onFilmClick,
}: {
  title: string;
  films: FilmData[];
  onFilmClick: (film: FilmData) => void;
}) => (
  <section>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {films.length > 6 && (
        <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          See All →
        </button>
      )}
    </div>
    {films.length === 0 ? (
      <p className="text-muted-foreground text-sm">No films yet. Add some from the Admin panel.</p>
    ) : (
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
        {films.map((film) => (
          <FilmCard key={film.id} film={film} onClick={() => onFilmClick(film)} />
        ))}
      </div>
    )}
  </section>
);

/* ── Film Card ── */
const FilmCard = ({
  film,
  onClick,
}: {
  film: FilmData;
  onClick: () => void;
}) => (
  <button onClick={onClick} className="group shrink-0 w-[180px] focus:outline-none">
    <div className="relative rounded-xl overflow-hidden aspect-[2/3] bg-secondary mb-2 border border-border group-hover:border-primary/50 transition-all group-hover:shadow-glow-primary">
      {film.thumbnail_url ? (
        <img
          src={film.thumbnail_url}
          alt={film.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-card">
          <Play className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center shadow-glow-primary">
          <Play className="w-5 h-5 text-primary-foreground ml-0.5" />
        </div>
      </div>
      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur text-xs px-2 py-0.5 rounded-md text-foreground">
        {getLanguageFlag(film.language ?? "fr")}
      </div>
    </div>
    <p className="text-sm text-foreground truncate text-left">{film.title}</p>
    <p className="text-xs text-muted-foreground text-left">
      {getLanguageLabel(film.language ?? "fr")}
    </p>
  </button>
);

/* ── Coming Soon Row ── */
const ComingSoonRow = ({ title }: { title: string }) => (
  <section>
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <span className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
        Coming Soon
      </span>
    </div>
    <div className="flex gap-4 overflow-x-auto pb-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="shrink-0 w-[180px]">
          <div className="rounded-xl aspect-[2/3] bg-secondary/30 border border-border/50 flex items-center justify-center mb-2">
            <Play className="w-8 h-8 text-muted-foreground/20" />
          </div>
          <div className="h-3 w-24 rounded bg-secondary/30" />
        </div>
      ))}
    </div>
  </section>
);

export default Browse;
