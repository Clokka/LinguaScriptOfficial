export interface AssetCredit {
  title: string;
  author: string;
  license: string;
  source: string;
  category: "pet" | "gift" | "accessory";
}

export const ASSET_CREDITS: AssetCredit[] = [
  {
    title: "Rose",
    author: "jeremy",
    license: "CC BY 4.0",
    source: "https://poly.pizza",
    category: "gift",
  },
  {
    title: "Tulip",
    author: "Hugo Gibson",
    license: "CC BY 4.0",
    source: "https://poly.pizza",
    category: "gift",
  },
  {
    title: "Cartoon Sneakers – Stylized 3D Shoes",
    author: "Xavinia",
    license: "CC BY 4.0",
    source: "https://sketchfab.com/xama27280",
    category: "accessory",
  },
  {
    title: "Trucker Hat Red (Toon)",
    author: "shimtimultimedia",
    license: "CC BY 4.0",
    source: "https://sketchfab.com/shimtimultimedia",
    category: "accessory",
  },
];
