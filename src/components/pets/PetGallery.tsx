import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Gift, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PETS, getPetById } from "@/lib/pets";
import { PetCard } from "./PetCard";
import { PetViewer } from "./PetViewer";
import { GiftPetModal } from "./GiftPetModal";
import { usePet } from "@/contexts/PetContext";

interface PetGalleryProps {
  open: boolean;
  onClose: () => void;
}

export function PetGallery({ open, onClose }: PetGalleryProps) {
  const { activePet, setActivePet, petCollection } = usePet();
  const [selected, setSelected] = useState<string | null>(activePet);
  const [giftingPet, setGiftingPet] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selectedPetMeta = selected ? getPetById(selected) : null;
  const selectedOwned = selected ? petCollection.includes(selected) : false;

  const handleChoose = async () => {
    if (!selected || !selectedOwned) return;
    setSaving(true);
    await setActivePet(selected);
    setSaving(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl w-full glass-panel-strong p-0 overflow-hidden max-h-[90vh]">
          <div className="flex flex-col h-full max-h-[90vh]">
            {/* Header */}
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/50 flex-shrink-0">
              <DialogTitle className="flex items-center gap-2 text-foreground text-lg">
                <span>🐾</span> My Pet Collection
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Choose your companion. They'll celebrate every milestone with you.
              </p>
            </DialogHeader>

            <div className="flex flex-1 overflow-hidden">
              {/* Pet grid */}
              <div className="flex-1 overflow-y-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {PETS.map((pet) => (
                    <PetCard
                      key={pet.id}
                      pet={pet}
                      owned={petCollection.includes(pet.id)}
                      active={activePet === pet.id}
                      onSelect={() => setSelected(pet.id)}
                    />
                  ))}
                </div>
              </div>

              {/* Preview panel (desktop) */}
              <AnimatePresence>
                {selectedPetMeta && (
                  <motion.div
                    key={selectedPetMeta.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="hidden sm:flex w-56 flex-shrink-0 flex-col items-center border-l border-border/50 p-5 gap-4"
                  >
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Preview</p>
                      <p className="font-semibold text-foreground">{selectedPetMeta.name}</p>
                    </div>

                    {selectedOwned ? (
                      <PetViewer
                        glbFile={selectedPetMeta.glbFile}
                        animation="Idle"
                        size={160}
                        autoRotate
                        cameraControls
                      />
                    ) : (
                      <div className="w-40 h-40 flex items-center justify-center text-6xl opacity-30">
                        {selectedPetMeta.emoji}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground text-center leading-relaxed">
                      {selectedPetMeta.description}
                    </p>

                    {selectedOwned && selected !== activePet && (
                      <Button
                        variant="hero"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={handleChoose}
                        disabled={saving}
                      >
                        <Check className="w-3.5 h-3.5" />
                        Choose {selectedPetMeta.name}
                      </Button>
                    )}

                    {selectedOwned && selected === activePet && (
                      <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
                        <Check className="w-3.5 h-3.5" />
                        Active companion
                      </div>
                    )}

                    {selectedOwned && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5 text-muted-foreground"
                        onClick={() => setGiftingPet(selected)}
                      >
                        <Gift className="w-3.5 h-3.5" />
                        Gift {selectedPetMeta.name}
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer CTA */}
            <div className="px-6 py-4 border-t border-border/50 flex-shrink-0 flex items-center justify-between gap-3">
              <Button variant="outline" onClick={onClose}>
                <X className="w-4 h-4 mr-1.5" /> Close
              </Button>
              {selectedPetMeta && selectedOwned && selected !== activePet && (
                <Button variant="hero" className="gap-1.5 sm:hidden" onClick={handleChoose} disabled={saving}>
                  <Check className="w-4 h-4" />
                  Choose {selectedPetMeta.name}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {giftingPet && (
        <GiftPetModal
          open={!!giftingPet}
          onClose={() => setGiftingPet(null)}
          petId={giftingPet}
        />
      )}
    </>
  );
}
