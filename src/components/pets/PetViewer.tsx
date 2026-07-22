// model-viewer web component wrapper for GLB pet models
import { useEffect, useRef } from "react";
import { ColorValue } from "@/lib/felixColors";

// Declare model-viewer as a valid JSX element
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          "auto-rotate"?: boolean | string;
          "camera-controls"?: boolean | string;
          "animation-name"?: string;
          autoplay?: boolean | string;
          "shadow-intensity"?: string;
          "environment-image"?: string;
          exposure?: string;
          "rotation-per-second"?: string;
          "field-of-view"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export type PetAnimation =
  | "Idle"
  | "Wave"
  | "Happy"
  | "Dance"
  | "Celebrate"
  | "Sleep"
  | "Excited";

interface PetViewerProps {
  glbFile: string;
  animation?: PetAnimation;
  size?: number | string;
  autoRotate?: boolean;
  cameraControls?: boolean;
  className?: string;
  languageColor?: ColorValue;
}

export function PetViewer({
  glbFile,
  animation = "Idle",
  size = 200,
  autoRotate = false,
  cameraControls = false,
  className = "",
  languageColor,
}: PetViewerProps) {
  const ref = useRef<HTMLElement>(null);

  // Update animation when prop changes
  useEffect(() => {
    const el = ref.current as any;
    if (!el) return;
    const set = () => {
      if (animation && el.availableAnimations?.includes(animation)) {
        el.animationName = animation;
      }
    };
    if (el.model) {
      set();
    } else {
      el.addEventListener("load", set, { once: true });
    }
  }, [animation]);

  // Apply language color to materials when it changes
  useEffect(() => {
    const el = ref.current as any;
    if (!el || !languageColor) return;

    const applyColor = () => {
      try {
        const scene = el.model?.scene;
        if (!scene) return;

        const targetColor = new (window as any).THREE.Color(
          languageColor.r / 255,
          languageColor.g / 255,
          languageColor.b / 255
        );

        scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((mat: any) => {
                if (mat.color) {
                  mat.color.copy(targetColor);
                }
              });
            } else if (child.material.color) {
              child.material.color.copy(targetColor);
            }
          }
        });
      } catch (e) {
        console.error("Failed to apply language color:", e);
      }
    };

    if (el.model) {
      applyColor();
    } else {
      el.addEventListener("load", applyColor, { once: true });
    }
  }, [languageColor]);

  const sizeStyle =
    typeof size === "number"
      ? { width: size, height: size }
      : { width: size, height: size };

  return (
    <model-viewer
      ref={ref as any}
      src={glbFile}
      alt="Pet companion"
      autoplay="true"
      animation-name={animation}
      shadow-intensity="0.3"
      exposure="1.1"
      {...(autoRotate ? { "auto-rotate": "true", "rotation-per-second": "30deg" } : {})}
      {...(cameraControls ? { "camera-controls": "true" } : {})}
      style={{ ...sizeStyle, background: "transparent" } as React.CSSProperties}
      className={className}
    />
  );
}
