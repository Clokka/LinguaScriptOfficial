import { motion } from "framer-motion";
import { Lock, Sparkles } from "lucide-react";
import { PetMeta, RARITY_COLORS, RARITY_GLOW, unlockLabel } from "@/lib/pets";
import { PetViewer } from "./PetViewer";
import { cn } from "@/lib/utils";

interface PetCardProps {
  pet: PetMeta;
  owned: boolean;
  active: boolean;
  onSelect: () => void;
}

export function PetCard({ pet, owned, active, onSelect }: PetCardProps) {
  const rarityClass = RARITY_COLORS[pet.rarity];
  const glowClass = RARITY_GLOW[pet.rarity];

  return (
    <motion.button
      whileHover={{ scale: owned ? 1.03 : 1.01, y: -2 }}
      whileTap={{ scale: 0.97 }}
      onClick={onSelect}
      className={cn(
        "relative rounded-2xl border p-4 text-left transition-all duration-200 w-full",
        "bg-secondary/40 backdrop-blur",
        active
          ? "border-primary ring-2 ring-primary/30 bg-primary/5"
          : "border-border/50 hover:border-border",
        !owned && "opacity-60 cursor-pointer",
        glowClass
      )}
    >
      {/* Active badge */}
      {active && (
        <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary/20 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5" />
          Active
        </div>
      )}

      {/* 3D Preview */}
      <div className="flex justify-center mb-3 relative">
        {owned ? (
          <PetViewer
            glbFile={pet.glbFile}
            animation="Idle"
            size={110}
            autoRotate
          />
        ) : (
          <div className="w-[110px] h-[110px] flex items-center justify-center text-5xl opacity-40 select-none">
            {pet.emoji}
          </div>
        )}
        {!owned && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-sm">
            <Lock className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-semibold text-foreground text-sm">{pet.name}</span>
          <span className={cn("text-[10px] font-medium uppercase tracking-wide", rarityClass)}>
            {pet.rarity}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
          {owned ? pet.description : `Unlock: ${unlockLabel(pet.unlock)}`}
        </p>
      </div>
    </motion.button>
  );
}
