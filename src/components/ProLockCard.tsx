import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChameleonMascot } from "@/components/ChameleonMascot";

/**
 * The soft upgrade moment for a Pro-only feature: a dancing chameleon on the
 * far side of a lock, and one quiet button. No pressure copy — the picture
 * says what's waiting.
 */
export function ProLockCard({ size = 160, className = "" }: { size?: number; className?: string }) {
  const navigate = useNavigate();
  return (
    <div className={`flex flex-col items-center gap-4 text-center ${className}`}>
      <div className="relative" style={{ width: size }}>
        <ChameleonMascot tier="green" dance style={{ width: size }} />
        <span
          aria-hidden
          className="absolute -top-2 -left-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber-400 text-black shadow-lg ring-4 ring-background"
        >
          <Lock className="h-5 w-5" />
        </span>
      </div>
      <Button onClick={() => navigate("/pricing")} className="rounded-full px-6">
        Try free for 14 days
      </Button>
    </div>
  );
}
