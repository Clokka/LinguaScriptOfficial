// Dedicated analytics page — houses the 7-stat dashboard and the per-video
// improvement history that used to clutter the Home tab.
import { useNavigate } from "react-router-dom";
import { PremiumHeader } from "@/components/premium";
import { YourProgressDashboard } from "@/components/YourProgressDashboard";
import { YourProgressSection } from "@/components/YourProgressSection";
import { ExperienceNav, MovingWords } from "@/components/premium/ExperienceNav";
import "@/components/premium/cinema.css";
import { LevelBadge } from "@/components/LevelBadge";

export default function Progress() {
  const navigate = useNavigate();
  return (
    <div className="ls-cinema min-h-screen bg-background">
      <PremiumHeader title="Your Progress" onBack={() => navigate("/discover")} right={<LevelBadge />} />
      <main className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-10">
        <ExperienceNav />
        <div><p className="text-xs font-semibold text-warning">YOUR LEARNING JOURNEY</p><h2 className="mt-3 text-3xl font-bold">Your language, turning green.</h2></div>
        <MovingWords />
        <YourProgressDashboard />
        <YourProgressSection />
      </main>
    </div>
  );
}
