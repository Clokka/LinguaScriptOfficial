// Dedicated analytics page — houses the 7-stat dashboard and the per-video
// improvement history that used to clutter the Home tab.
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YourProgressDashboard } from "@/components/YourProgressDashboard";
import { YourProgressSection } from "@/components/YourProgressSection";
import { LevelBadge } from "@/components/LevelBadge";

export default function Progress() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-6 py-3 max-w-6xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => navigate("/discover")} className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <h1 className="text-base font-semibold text-foreground">Your Progress</h1>
          <div className="ml-auto"><LevelBadge /></div>
        </div>
      </header>
      <main className="px-6 py-8 max-w-6xl mx-auto space-y-10">
        <YourProgressDashboard />
        <YourProgressSection />
      </main>
    </div>
  );
}
