// The learner's bottom tabs on the website ("remote control"): Today · Words · Me.
// LinguaScripts is parked until phrases follow each learner's course, goal and
// hobby (docs/plans/linguascript-builder.md); add it back here when it returns.
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/home", icon: "🏠", label: "Today" },
  { to: "/flashcards", icon: "🃏", label: "Words" },
  { to: "/profile", icon: "🦎", label: "Me" },
];

export function AppTabs() {
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/5 bg-background/85 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto grid max-w-2xl grid-cols-3">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex flex-col items-center py-2.5 text-xs font-semibold ${isActive ? "text-emerald-400" : "text-muted-foreground"}`}>
            <span className="text-xl leading-none" aria-hidden>{t.icon}</span>{t.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
