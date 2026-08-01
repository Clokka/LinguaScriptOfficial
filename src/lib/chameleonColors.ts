/**
 * Chameleon color progression based on comprehension %
 * Red (0%) → Orange (50%) → Green (100%) → Gold/Aurora (hyper at 100%)
 */

export interface ColorValue {
  r: number;
  g: number;
  b: number;
}

const hexToRgb = (h: string): [number, number, number] => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

const lerpHex = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};

const RED = "#ef4444";
const ORANGE = "#fb923c";
const GREEN = "#34d399";

/**
 * Get RGB color for a comprehension percentage (0–100)
 * 0% = red, 50% = orange, 100% = green
 */
export function getComprehensionColor(percent: number): ColorValue {
  const hex = percent < 50 ? lerpHex(RED, ORANGE, percent / 50) : lerpHex(ORANGE, GREEN, (percent - 50) / 50);
  const [r, g, b] = hexToRgb(hex);
  return { r, g, b };
}

/**
 * Hyper mode color: cycling gold/aurora for that level-up moment
 */
export function getHyperColor(time: number): ColorValue {
  // Pulsing gold + faint rainbow shift
  const gold = { r: 245, g: 179, b: 1 };
  const pulse = 0.5 + 0.5 * Math.sin(time * 5);
  return {
    r: Math.round(gold.r * (0.8 + pulse * 0.2)),
    g: Math.round(gold.g * (0.8 + pulse * 0.2)),
    b: Math.round(gold.b + Math.sin(time * 3) * 50),
  };
}
