// Dedicated analytics page — houses the 7-stat dashboard and the per-video
// improvement history that used to clutter the Home tab.
import { useNavigate } from "react-router-dom";
import { PremiumHeader } from "@/components/premium";
import { YourProgressDashboard } from "@/components/YourProgressDashboard";
import { YourProgressSection } from "@/components/YourProgressSection";
import { LevelBadge } from "@/components/LevelBadge";

export default function Progress() {
  const navigate = useNavigate();
  return (
    <div className="ls-aurora min-h-screen bg-background">
      <PremiumHeader title="Your Progress" onBack={() => navigate("/discover")} right={<LevelBadge />} />
      <main className="px-4 sm:px-6 py-8 max-w-6xl mx-auto space-y-10">
        <YourProgressDashboard />
        <YourProgressSection />
      </main>
    </div>
  );
}
