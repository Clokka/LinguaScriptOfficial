export type UnlockMethod =
  | { type: "free" }
  | { type: "gems"; amount: number }
  | { type: "streak"; days: number }
  | { type: "videos"; count: number }
  | { type: "achievement"; name: string }
  | { type: "seasonal"; event: string };

export interface PetMeta {
  id: string;
  name: string;
  emoji: string;
  description: string;
  glbFile: string;
  unlock: UnlockMethod;
  rarity: "common" | "uncommon" | "rare" | "legendary";
}

export const PETS: PetMeta[] = [
  {
    id: "sparrow",
    name: "Sparrow",
    emoji: "🐦",
    description: "A cheerful little bird who tweets encouragement.",
    glbFile: "/pets/Sparrow_Animations.glb",
    unlock: { type: "free" },
    rarity: "common",
  },
  {
    id: "chameleon",
    name: "Chameleon",
    emoji: "🦎",
    description: "Your chameleon changes colour as you learn — red, orange, then green.",
    glbFile: "/pets/Chameleon_Animations.glb",
    unlock: { type: "free" },
    rarity: "common",
  },
  {
    id: "colobus",
    name: "Colobus",
    emoji: "🐒",
    description: "A wise monkey who swings through your progress.",
    glbFile: "/pets/Colobus_Animations.glb",
    unlock: { type: "gems", amount: 200 },
    rarity: "uncommon",
  },
  {
    id: "muskrat",
    name: "Muskrat",
    emoji: "🐭",
    description: "A determined muskrat who rewards your streaks.",
    glbFile: "/pets/Muskrat_Animations.glb",
    unlock: { type: "streak", days: 7 },
    rarity: "uncommon",
  },
  {
    id: "pudu",
    name: "Pudu",
    emoji: "🦌",
    description: "The world's smallest deer, with a huge heart.",
    glbFile: "/pets/Pudu_Animations.glb",
    unlock: { type: "videos", count: 10 },
    rarity: "rare",
  },
  {
    id: "herring",
    name: "Herring",
    emoji: "🐟",
    description: "A silver herring who dives deep into vocabulary.",
    glbFile: "/pets/Herring_Animations.glb",
    unlock: { type: "videos", count: 25 },
    rarity: "rare",
  },
  {
    id: "inkfish",
    name: "Inkfish",
    emoji: "🦑",
    description: "A mysterious inkfish who leaves trails of XP.",
    glbFile: "/pets/Inkfish_Animations.glb",
    unlock: { type: "gems", amount: 1000 },
    rarity: "legendary",
  },
  {
    id: "taipan",
    name: "Taipan",
    emoji: "🐍",
    description: "A rare taipan — only the most dedicated learners earn this.",
    glbFile: "/pets/Taipan_Animations.glb",
    unlock: { type: "achievement", name: "Polyglot" },
    rarity: "legendary",
  },
  {
    id: "hedgehog",
    name: "Hedgehog",
    emoji: "🦔",
    description: "A shy, cheerful hedgehog who bounces alongside your progress.",
    glbFile: "/pets/Hedgehog_Animations.glb",
    unlock: { type: "seasonal", event: "Gifted" },
    rarity: "legendary",
  },
];

export function getPetById(id: string): PetMeta | undefined {
  return PETS.find((p) => p.id === id);
}

export function unlockLabel(unlock: UnlockMethod): string {
  switch (unlock.type) {
    case "free":
      return "Free";
    case "gems":
      return `${unlock.amount} Gems`;
    case "streak":
      return `${unlock.days}-day streak`;
    case "videos":
      return `Watch ${unlock.count} videos`;
    case "achievement":
      return `Achievement: ${unlock.name}`;
    case "seasonal":
      return `Seasonal: ${unlock.event}`;
  }
}

export const RARITY_COLORS: Record<PetMeta["rarity"], string> = {
  common: "text-slate-400 border-slate-400/30",
  uncommon: "text-emerald-400 border-emerald-400/30",
  rare: "text-blue-400 border-blue-400/30",
  legendary: "text-amber-400 border-amber-400/40",
};

export const RARITY_GLOW: Record<PetMeta["rarity"], string> = {
  common: "",
  uncommon: "shadow-[0_0_16px_rgba(52,211,153,0.15)]",
  rare: "shadow-[0_0_16px_rgba(96,165,250,0.2)]",
  legendary: "shadow-[0_0_24px_rgba(251,191,36,0.3)]",
};
