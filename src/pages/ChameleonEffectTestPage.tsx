// Chameleon Effect Test Page — individual effect auditing
// Discrete color states (RED/ORANGE/GREEN) with emissive glow
// Character aura effect like Smash Bros godmode or DBZ Super Saiyan
import { useState, useRef } from "react";
import { PetLive, PetLiveHandle } from "@/components/pets/PetLive";
import { Button } from "@/components/ui/button";

// Discrete color states with emissive properties
const COLOR_STATES = {
  red: { hex: "#FF3B30", emissive: "#ff0000", emissiveIntensity: 0.4 },
  orange: { hex: "#FF8A00", emissive: "#ff6600", emissiveIntensity: 0.7 },
  green: { hex: "#34C759", emissive: "#00ff00", emissiveIntensity: 1.0 },
};

type ColorState = "red" | "orange" | "green";

interface ColorStateConfig {
  name: string;
  description: string;
  state: ColorState;
  comprehension: number;
}

interface ColorStateBoxProps {
  title: string;
  state: ColorState;
  comprehension: number;
}

const ColorStateBox = ({ title, state, comprehension }: ColorStateBoxProps) => {
  const chameleonRef = useRef<PetLiveHandle>(null);
  const colorConfig = COLOR_STATES[state];

  const handleSpin = () => {
    chameleonRef.current?.play("Spin");
  };

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4 backdrop-blur">
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      <p className="text-xs text-muted-foreground mb-3">
        {state.toUpperCase()} — Emissive: {colorConfig.emissive} @ {(colorConfig.emissiveIntensity * 100).toFixed(0)}%
      </p>

      <div className="relative h-[240px] w-full rounded-lg border border-border/40 bg-black/20 flex items-center justify-center mb-4 overflow-hidden">
        <PetLive
          ref={chameleonRef}
          glbFile="/pets/Chameleon_Animations.glb"
          size={180}
          comprehensionPercent={comprehension}
          tint={{
            emissive: colorConfig.emissive,
            emissiveIntensity: colorConfig.emissiveIntensity,
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Button size="sm" onClick={handleSpin} className="w-full text-xs">
          Spin (Test Glow)
        </Button>
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded border-2 border-border"
            style={{ background: colorConfig.hex, boxShadow: `0 0 12px ${colorConfig.emissive}` }}
          />
          <div className="flex flex-col">
            <span className="text-xs font-mono font-bold">{colorConfig.hex}</span>
            <span className="text-xs text-muted-foreground">Base color</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function ChameleonEffectTestPage() {
  const [comprehension, setComprehension] = useState(0);

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Chameleon Color State Test</h1>
          <p className="text-muted-foreground mb-6">
            Emissive glow effects for discrete RED → ORANGE → GREEN comprehension states
          </p>

          {/* Comprehension Slider */}
          <div className="rounded-lg border border-border/60 bg-background/40 p-6 backdrop-blur mb-6">
            <label className="text-sm font-semibold mb-4 block">Comprehension Level</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={comprehension}
                onChange={(e) => setComprehension(Number(e.target.value))}
                className="flex-1"
              />
              <span className="text-2xl font-bold w-16 text-right">{comprehension}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Current state: <span className="font-semibold">
                {comprehension < 40 ? "RED (New)" : comprehension < 70 ? "ORANGE (Learning)" : "GREEN (Mastered)"}
              </span>
            </p>
          </div>
        </div>

        {/* Discrete Color States Grid */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Discrete Color States with Emissive Glow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ColorStateBox
              title="RED State"
              state="red"
              comprehension={0}
            />
            <ColorStateBox
              title="ORANGE State"
              state="orange"
              comprehension={50}
            />
            <ColorStateBox
              title="GREEN State"
              state="green"
              comprehension={100}
            />
          </div>
        </div>

        {/* Interactive State Display */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Interactive State Preview</h2>
          <div className="rounded-xl border border-border/60 bg-background/40 p-6 backdrop-blur">
            <p className="text-sm text-muted-foreground mb-4">
              Adjust the comprehension slider above to see Chameleon transition between states
            </p>
            <div className="relative h-[320px] w-full rounded-lg border border-border/40 bg-black/20 flex items-center justify-center">
              <ColorStateBox
                title="Live Preview"
                state={comprehension < 40 ? "red" : comprehension < 70 ? "orange" : "green"}
                comprehension={comprehension}
              />
            </div>
          </div>
        </div>

        {/* Technical Notes */}
        <div className="rounded-lg border border-border/60 bg-background/40 p-6 backdrop-blur text-sm text-muted-foreground">
          <h3 className="font-bold text-foreground mb-3">Emissive Glow Effect Details</h3>
          <ul className="list-disc list-inside space-y-2">
            <li><span className="font-semibold text-red-400">RED (0%):</span> Emissive #ff0000 @ 40% intensity — Subtle red glow</li>
            <li><span className="font-semibold text-amber-400">ORANGE (50%):</span> Emissive #ff6600 @ 70% intensity — Strong orange glow</li>
            <li><span className="font-semibold text-green-400">GREEN (100%):</span> Emissive #00ff00 @ 100% intensity — Intense green glow</li>
            <li>Character emissive materials create the glow effect (like Smash Bros godmode aura)</li>
            <li>No surrounding particles — the character itself becomes the glowing source</li>
            <li>Discrete states ensure clear visual feedback for comprehension milestones</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
