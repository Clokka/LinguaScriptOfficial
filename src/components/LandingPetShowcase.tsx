// Landing-page showcase of the 3D GLB study companions. Mounts each
// WebGL viewer only once the card scrolls into view, so the landing page
// pays no GPU/network cost until the section is seen (~270 KB per model).
import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { getPetById, unlockLabel, RARITY_COLORS, RARITY_GLOW } from "@/lib/pets";
import { PetLive, PetLiveHandle } from "@/components/pets/PetLive";
import { cn } from "@/lib/utils";

// A deliberate ladder: free → streak → videos → legendary.
const SHOWCASE_IDS = ["chameleon", "muskrat", "pudu", "inkfish"] as const;

const HOVER_CLIPS = ["Bounce", "Spin", "Jump", "Roll"];

interface PetCardProps {
  petId: string;
  index: number;
  comprehensionPercent?: number;
}

const PetCard = ({ petId, index, comprehensionPercent }: PetCardProps) => {
  const pet = getPetById(petId);
  const cardRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<PetLiveHandle>(null);
  const inView = useInView(cardRef, { once: true, margin: "120px" });
  const [ready, setReady] = useState(false);
  const clipIdx = useRef(0);

  if (!pet) return null;

  const poke = () => {
    liveRef.current?.play(HOVER_CLIPS[clipIdx.current % HOVER_CLIPS.length]);
    clipIdx.current += 1;
  };

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08, duration: 0.5 }}
      className={cn(
        "glass-panel rounded-2xl border p-5 text-center transition-all duration-500 hover:-translate-y-1.5",
        RARITY_COLORS[pet.rarity].split(" ")[1],
        RARITY_GLOW[pet.rarity],
      )}
    >
      <div
        className="relative mx-auto flex h-[180px] w-[180px] cursor-pointer items-center justify-center"
        onMouseEnter={poke}
        onClick={poke}
        role="img"
        aria-label={`${pet.name} 3D companion`}
      >
        {!ready && (
          <span className="absolute text-5xl opacity-40" aria-hidden>
            {pet.emoji}
          </span>
        )}
        {inView && (
          <div className={cn("transition-opacity duration-500", ready ? "opacity-100" : "opacity-0")}>
            <PetLive
              ref={liveRef}
              glbFile={pet.glbFile}
              size={180}
              comprehensionPercent={petId === "chameleon" ? comprehensionPercent : undefined}
              onReady={() => setReady(true)}
            />
          </div>
        )}
      </div>
      <h3 className="mt-1 text-lg font-bold">
        {pet.name} <span aria-hidden>{pet.emoji}</span>
      </h3>
      <span
        className={cn(
          "mt-1 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
          RARITY_COLORS[pet.rarity],
        )}
      >
        {pet.rarity}
      </span>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{pet.description}</p>
      <p className="mt-3 text-xs font-semibold text-foreground/70">
        Unlock: <span className="text-emerald-400">{unlockLabel(pet.unlock)}</span>
      </p>
    </motion.div>
  );
};

interface LandingPetShowcaseProps {
  comprehensionPercent?: number;
}

export const LandingPetShowcase = ({ comprehensionPercent }: LandingPetShowcaseProps = {}) => (
  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    {SHOWCASE_IDS.map((id, i) => (
      <PetCard key={id} petId={id} index={i} comprehensionPercent={comprehensionPercent} />
    ))}
  </div>
);
