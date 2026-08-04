import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Check, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getPetById } from "@/lib/pets";
import { usePet } from "@/contexts/PetContext";
import { GiftUnboxScene, type GiftUnboxHandle } from "@/components/pets/GiftUnboxScene";

type Status =
  | "loading"
  | "ready_to_open"
  | "opening"
  | "opened"
  | "claiming"
  | "success"
  | "error"
  | "already_owned"
  | "need_auth";

interface Preview {
  pet_id: string;
  accessories: string[];
  sender_username: string | null;
  claimed: boolean;
  expired: boolean;
}

function isInstagramInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Instagram|FBAN|FBAV/i.test(ua);
}

export default function GiftClaim() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addToCollection, triggerReaction } = usePet();
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<Status>("loading");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [sceneReady, setSceneReady] = useState(false);
  const sceneRef = useRef<GiftUnboxHandle | null>(null);

  const inAppBrowser = useMemo(() => isInstagramInAppBrowser(), []);
  const pet = preview?.pet_id ? getPetById(preview.pet_id) : null;

  // Load link preview once we have a token.
  useEffect(() => {
    if (!token) {
      setStatus("error");
      setErrorMsg("No gift token provided.");
      return;
    }
    if (authLoading) return;

    (async () => {
      const { data, error } = await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ data: unknown; error: { message: string } | null }>)(
        "get_gift_link_preview",
        { p_token: token }
      );

      if (error) {
        setStatus("error");
        setErrorMsg(error.message);
        return;
      }
      const row = data as Preview & { error?: string };
      if (!row || row.error === "not_found") {
        setStatus("error");
        setErrorMsg("Gift link not found.");
        return;
      }
      if (row.claimed) {
        setStatus("error");
        setErrorMsg("This gift has already been claimed.");
        return;
      }
      if (row.expired) {
        setStatus("error");
        setErrorMsg("This gift link has expired.");
        return;
      }

      setPreview({
        pet_id: row.pet_id,
        accessories: row.accessories ?? [],
        sender_username: row.sender_username ?? null,
        claimed: false,
        expired: false,
      });
      setStatus("ready_to_open");
    })();
  }, [token, authLoading, user]);

  const handleOpen = () => {
    if (!sceneRef.current || status !== "ready_to_open") return;
    setStatus("opening");
    sceneRef.current.open();
  };

  const handleClaim = async () => {
    if (!user) {
      navigate(`/auth?redirect=/gift?token=${token}`);
      return;
    }
    setStatus("claiming");

    const { data, error } = await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>)(
      "claim_gift_link",
      { p_token: token }
    );

    const payload = data as { error?: string; pet_id?: string } | null;
    if (error || payload?.error) {
      setErrorMsg(payload?.error ?? error?.message ?? "Something went wrong");
      setStatus("error");
      return;
    }

    if (payload?.pet_id) {
      await addToCollection(payload.pet_id);
      triggerReaction("celebrate", 5000);
    }
    setStatus("success");
  };

  const senderLabel = preview?.sender_username
    ? `From ${preview.sender_username}`
    : "A gift for you";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-gradient-hero pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="relative z-10 glass-panel-strong p-6 sm:p-8 max-w-sm w-full text-center"
      >
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-muted-foreground">Opening your gift…</p>
          </div>
        )}

        {(status === "ready_to_open" ||
          status === "opening" ||
          status === "opened" ||
          status === "claiming" ||
          status === "need_auth" ||
          status === "success") &&
          preview && pet && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">{senderLabel}</p>

              <GiftUnboxScene
                ref={sceneRef}
                accessories={preview.accessories}
                onReady={() => setSceneReady(true)}
                onOpenComplete={() => setStatus("opened")}
              />

              <AnimatePresence mode="wait">
                {status === "ready_to_open" && (
                  <motion.div
                    key="pre"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="space-y-3"
                  >
                    <p className="text-foreground text-lg font-medium">
                      A gift for you 🎁
                    </p>
                    <p className="text-muted-foreground text-sm">
                      Tap the box to see what's inside.
                    </p>
                    <Button
                      variant="hero"
                      size="lg"
                      className="w-full gap-2"
                      onClick={handleOpen}
                      disabled={!sceneReady}
                    >
                      {sceneReady ? (
                        <>
                          <Sparkles className="w-4 h-4" /> Open your gift
                        </>
                      ) : (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" /> Getting it
                          ready…
                        </>
                      )}
                    </Button>
                  </motion.div>
                )}

                {status === "opening" && (
                  <motion.p
                    key="opening"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-muted-foreground text-sm"
                  >
                    ✨
                  </motion.p>
                )}

                {status === "opened" && (
                  <motion.div
                    key="opened"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <h1 className="text-2xl font-bold text-foreground">
                      You met {pet.name} {pet.emoji}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                      {pet.description}
                    </p>
                    {user ? (
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full gap-2"
                        onClick={handleClaim}
                      >
                        <Gift className="w-4 h-4" /> Keep {pet.name}
                      </Button>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Sign in to keep {pet.name} forever.
                        </p>
                        <Button
                          variant="hero"
                          size="lg"
                          className="w-full"
                          onClick={() =>
                            navigate(`/auth?redirect=/gift?token=${token}`)
                          }
                        >
                          Sign in to claim
                        </Button>
                      </div>
                    )}
                  </motion.div>
                )}

                {status === "claiming" && (
                  <motion.div
                    key="claiming"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center justify-center gap-2 text-muted-foreground"
                  >
                    <Loader2 className="w-4 h-4 animate-spin" /> Adding to your
                    collection…
                  </motion.div>
                )}

                {status === "success" && (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-center gap-2 text-emerald-400">
                      <Check className="w-5 h-5" />
                      <span className="font-medium">
                        {pet.name} is yours!
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="hero"
                        size="lg"
                        className="w-full"
                        onClick={() => navigate("/profile")}
                      >
                        View in My Pet Collection
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full"
                        onClick={() => navigate("/")}
                      >
                        Start Learning
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {inAppBrowser && status === "ready_to_open" && (
                <p className="text-[11px] text-muted-foreground mt-3">
                  For the smoothest experience, tap the ⋯ menu and choose{" "}
                  <span className="text-foreground">Open in browser</span>.
                </p>
              )}
            </div>
          )}

        {status === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Couldn't open gift
              </h1>
              <p className="text-muted-foreground text-sm mt-1">{errorMsg}</p>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              Go to LinguaScript
            </Button>
          </div>
        )}

        <p className="mt-6 text-[10px] text-muted-foreground/60">
          <button
            className="hover:text-muted-foreground transition-colors"
            onClick={() => navigate("/credits")}
          >
            3D asset credits
          </button>
        </p>
      </motion.div>
    </div>
  );
}
