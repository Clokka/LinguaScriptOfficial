// Felix Effect Test Page — individual effect auditing
// Test scale pulse, aurora cascade, glow, gold sweep, confetti separately
// Compare color variations against flashcard palette
import { useState, useRef, useCallback } from "react";
import { PetLive, PetLiveHandle } from "@/components/pets/PetLive";
import { Button } from "@/components/ui/button";

// Flashcard palette
const COLORS = {
  red: "#FF3B30",
  orange: "#FF8A00",
  green: "#34C759",
  gold: "#fbbf24",
  blue: "#60a5fa",
  purple: "#a78bfa",
};

type EffectType = "none" | "scale-pulse" | "aurora-glow" | "scale+aurora" | "rainbow-shimmer" | "all";

interface EffectConfig {
  name: string;
  description: string;
  type: EffectType;
}

const EFFECTS: EffectConfig[] = [
  { name: "None", description: "Baseline — no effects", type: "none" },
  { name: "Scale Pulse", description: "4-phase grow/shrink", type: "scale-pulse" },
  { name: "Aurora Glow", description: "Expanding halo glow", type: "aurora-glow" },
  { name: "Scale + Aurora", description: "Combined pulse & glow", type: "scale+aurora" },
  { name: "Rainbow Shimmer", description: "Gradient cascade", type: "rainbow-shimmer" },
  { name: "All Effects", description: "Complete ascension", type: "all" },
];

interface TestProps {
  title: string;
  effect: EffectType;
  color?: string;
  comprehension?: number;
}

const FelixTestBox = ({ title, effect, color, comprehension }: TestProps) => {
  const felixRef = useRef<PetLiveHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);

  const triggerEffect = () => {
    setIsActive(true);
    felixRef.current?.play("Spin");
    setTimeout(() => setIsActive(false), 2500);
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 backdrop-blur">
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">{effect}</p>

      <div
        ref={containerRef}
        className="relative h-[200px] w-full rounded-lg border border-border/40 bg-black/20 flex items-center justify-center mb-4 overflow-hidden"
        style={
          isActive
            ? {
                animation:
                  effect === "scale-pulse" || effect === "scale+aurora" || effect === "all"
                    ? "test-scale-pulse 0.8s ease-out"
                    : undefined,
                boxShadow:
                  (effect === "aurora-glow" || effect === "scale+aurora" || effect === "all") &&
                  isActive
                    ? "0 0 60px 30px rgba(96, 165, 250, 0.3), inset 0 0 40px rgba(167, 139, 250, 0.2)"
                    : undefined,
              }
            : undefined
        }
      >
        <style>{`
          @keyframes test-scale-pulse {
            0% { transform: scale(1); }
            20% { transform: scale(1.12); }
            40% { transform: scale(0.96); }
            60% { transform: scale(1.06); }
            80% { transform: scale(1); }
            100% { transform: scale(1); }
          }
          @keyframes test-rainbow {
            0% { background: radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 100%); }
            50% { background: radial-gradient(circle, rgba(96,165,250,0.3) 0%, transparent 100%); }
            100% { background: radial-gradient(circle, rgba(251,191,36,0.3) 0%, transparent 100%); }
          }
        `}</style>

        {(effect === "rainbow-shimmer" || effect === "all") && isActive && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ animation: "test-rainbow 1.2s ease-out forwards" }}
          />
        )}

        <PetLive
          ref={felixRef}
          glbFile="/pets/Chameleon_Animations.glb"
          size={160}
          comprehensionPercent={comprehension ?? 0}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={triggerEffect} className="w-full text-xs">
          Test Effect
        </Button>
        {color && (
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded border border-border"
              style={{ background: color }}
            />
            <span className="text-xs font-mono text-muted-foreground">{color}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default function FelixEffectTestPage() {
  const [selectedColor, setSelectedColor] = useState(COLORS.red);
  const [comprehension, setComprehension] = useState(0);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Felix Effect Test Page</h1>
          <p className="text-muted-foreground mb-6">
            Audit individual effects, color variations, and comprehension states
          </p>

          {/* Controls */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-4 backdrop-blur mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">Color Palette</label>
                <div className="flex gap-2">
                  {Object.entries(COLORS).map(([name, hex]) => (
                    <button
                      key={hex}
                      onClick={() => setSelectedColor(hex)}
                      className={`w-10 h-10 rounded border-2 transition ${
                        selectedColor === hex ? "border-foreground" : "border-border/40"
                      }`}
                      style={{ background: hex }}
                      title={`${name}: ${hex}`}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Comprehension %</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comprehension}
                    onChange={(e) => setComprehension(Number(e.target.value))}
                    className="flex-1"
                  />
                  <span className="text-sm font-bold w-12">{comprehension}%</span>
                </div>
              </div>

              <div>
                <label className="text-sm font-semibold mb-2 block">Selected Color</label>
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded border border-border"
                    style={{ background: selectedColor }}
                  />
                  <span className="text-xs font-mono">{selectedColor}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Effects Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Individual Effects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {EFFECTS.map((effect) => (
              <FelixTestBox
                key={effect.type}
                title={effect.name}
                effect={effect.description as EffectType}
                color={selectedColor}
                comprehension={comprehension}
              />
            ))}
          </div>
        </div>

        {/* Color Audit */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Color Audit (Flashcard Palette)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { name: "Red (New)", hex: COLORS.red },
              { name: "Orange (Learning)", hex: COLORS.orange },
              { name: "Green (Mastered)", hex: COLORS.green },
            ].map(({ name, hex }) => (
              <FelixTestBox
                key={hex}
                title={name}
                effect="all"
                color={hex}
                comprehension={[0, 50, 100][["red", "orange", "green"].indexOf(name.split(" ")[0])]}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-6 backdrop-blur text-sm text-muted-foreground">
          <h3 className="font-bold text-foreground mb-3">Audit Notes</h3>
          <ul className="list-disc list-inside space-y-1">
            <li>Click "Test Effect" to trigger animation on each Felix</li>
            <li>Change comprehension % to see color progression</li>
            <li>Compare color hex values against flashcard palette</li>
            <li>Monitor for disappearing Felix or effect overlap issues</li>
            <li>Check animation synchronization and timing</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
