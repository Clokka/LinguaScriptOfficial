import { NavLink } from "react-router-dom";
import { BarChart3, BookOpen, GraduationCap, Play, Users, Volume2, Flame, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const SCHOOL_EXPERIENCES = [
  { slug: "watch", label: "Watch", icon: Play },
  { slug: "pronunciation", label: "Pronunciation", icon: Volume2 },
  { slug: "vocabulary", label: "Vocabulary", icon: BookOpen },
  { slug: "progress", label: "Progress", icon: BarChart3 },
  { slug: "teachers", label: "Teacher dashboard", icon: Users },
  { slug: "habits", label: "Goals & friends", icon: Flame },
  { slug: "connections", label: "AI connections", icon: Link2 },
] as const;

export function ExperienceNav({ tour = false }: { tour?: boolean }) {
  const destinations = tour ? SCHOOL_EXPERIENCES.map(x => ({ ...x, to: `/schools/tour/${x.slug}` })) : [
    { label: "Watch", to: "/discover", icon: Play },
    { label: "Flashcards", to: "/flashcards", icon: BookOpen },
    { label: "Progress", to: "/progress", icon: BarChart3 },
    { label: "Schools", to: "/for-schools", icon: GraduationCap },
  ];
  return <nav className="ls-experience-nav" aria-label={tour ? "School product tour" : "Learning pages"}>
    {destinations.map(({ label, to, icon: Icon }) => <Button key={to} variant="ghost" asChild size="sm">
      <NavLink to={to} className={({ isActive }) => isActive ? "ls-nav-active" : ""}><Icon className="mr-2 h-4 w-4" />{label}</NavLink>
    </Button>)}
  </nav>;
}

export function MovingWords() {
  return <div className="ls-caption-glass"><div className="ls-marquee" aria-hidden="true" translate="no"><div className="ls-marquee-line">
    {Array.from({ length: 4 }, (_, i) => ["bonjour", "cinéma", "voyage", "demain", "ensemble", "apprendre"].map(word => <span key={`${i}-${word}`}>{word}</span>))}
  </div></div></div>;
}