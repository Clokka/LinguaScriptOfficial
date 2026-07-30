import { useEffect, useState } from "react";
import { ChameleonMascot, type ChameleonTier } from "@/components/ChameleonMascot";

/**
 * The Quirky-Series chameleon as an actual 3D model.
 *
 * Uses the <model-viewer> web component already loaded in index.html (the same
 * one the pet system uses), pointed at the optimised GLB — 20.2 MB of raw
 * upload compressed to 678 KB so it can sit on a landing page.
 *
 * If model-viewer hasn't defined itself (CDN blocked, offline, slow network) we
 * fall back to the flat mascot rather than showing an empty box.
 */
export const Chameleon3D = ({
  tier = "green",
  size = 340,
  className = "",
}: {
  tier?: ChameleonTier;
  size?: number;
  className?: string;
}) => {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // model-viewer registers asynchronously from a CDN module script.
    customElements
      .whenDefined("model-viewer")
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setFailed(true));

    // Don't wait forever on a blocked or slow CDN.
    const t = window.setTimeout(() => !cancelled && setFailed(true), 6000);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  if (failed && !ready) {
    return (
      <div className={className} style={{ width: size }}>
        <ChameleonMascot tier={tier} />
      </div>
    );
  }

  return (
    <div className={className} style={{ width: size, height: size }}>
      {/* model-viewer is a custom element; its JSX type is declared in PetViewer.tsx */}
      <model-viewer
        src="/brand/chameleon.glb"
        alt="The LinguaScript chameleon, in 3D"
        autoplay="true"
        auto-rotate="true"
        rotation-per-second="18deg"
        camera-controls="true"
        shadow-intensity="0.45"
        exposure="1.15"
        field-of-view="28deg"
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
          opacity: ready ? 1 : 0,
          transition: "opacity .6s ease",
        }}
      />
    </div>
  );
};

export default Chameleon3D;
