import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChameleonMascot } from "@/components/ChameleonMascot";
import { ProLockCard } from "@/components/ProLockCard";

export type VideoBlockKind = "missing" | "locked" | "limit" | "error";

/**
 * Shown instead of the player when a video can't become a lesson. The
 * chameleon carries the message; text is one short line at most.
 *   missing — no subtitle track in the learning language (sad, the one place
 *             the sad chameleon is used)
 *   locked  — new videos are a Pro feature (dancing chameleon behind a lock)
 *   limit   — today's new video is used (back tomorrow)
 *   error   — a temporary failure loading subtitles
 */
export function VideoBlockedScreen({ kind }: { kind: VideoBlockKind }) {
  const navigate = useNavigate();
  const discover = (
    <Button variant={kind === "locked" ? "ghost" : "default"} onClick={() => navigate("/discover")} className="rounded-full px-6">
      Discover
    </Button>
  );

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="flex max-w-xs flex-col items-center gap-4 text-center">
        {kind === "locked" ? (
          <ProLockCard size={180} />
        ) : (
          <>
            <ChameleonMascot
              tier={kind === "missing" ? "orange" : "green"}
              mood={kind === "missing" ? "sad" : "happy"}
              style={{ width: 180 }}
            />
            <p className="text-sm text-muted-foreground">
              {kind === "missing" && "No subtitles on this video"}
              {kind === "limit" && "New video tomorrow 🌙"}
              {kind === "error" && "Subtitles didn't load"}
            </p>
          </>
        )}
        <div className="flex flex-col gap-2">
          {discover}
          {kind === "error" && (
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Try again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
