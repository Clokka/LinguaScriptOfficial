export type AccessorySlot = "head" | "feet" | "body";

export interface AccessoryMeta {
  id: string;
  name: string;
  emoji: string;
  slot: AccessorySlot;
  glbFile: string;
  /** How many instances to spawn (e.g. one shoe per foot = 4 on a quadruped). */
  perLimb?: boolean;
}

export const ACCESSORIES: AccessoryMeta[] = [
  {
    id: "sneakers",
    name: "Cartoon Sneakers",
    emoji: "👟",
    slot: "feet",
    glbFile: "/accessories/Sneakers.glb",
    perLimb: true,
  },
  {
    id: "trucker_hat",
    name: "Trucker Hat",
    emoji: "🧢",
    slot: "head",
    glbFile: "/accessories/TruckerHat.glb",
  },
];

export function getAccessoryById(id: string): AccessoryMeta | undefined {
  return ACCESSORIES.find((a) => a.id === id);
}
