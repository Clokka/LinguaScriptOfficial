/**
 * Video styles. Brand rule: red / orange / green / gold carry meaning (word
 * states); white, near-black and the brand green #7bbf27 are the rest.
 */
export interface Theme {
  id: string;
  name: string;
  bg: string;
  /** Second background tone for the soft glow behind the device. */
  glow: string;
  fg: string;
  muted: string;
  surface: string;
  line: string;
  /** Light background → word colours use deeper shades so they stay readable. */
  light: boolean;
  /** Caption weight / case. */
  captionWeight: number;
  captionCase: "none" | "uppercase";
}

export const THEMES: Theme[] = [
  {
    id: "midnight", name: "Midnight",
    bg: "#08080B", glow: "rgba(52,199,89,0.16)", fg: "#F5F5F7", muted: "#9A9AA6",
    surface: "#121218", line: "#24242D", light: false, captionWeight: 800, captionCase: "none",
  },
  {
    id: "daylight", name: "Daylight",
    bg: "#FFFFFF", glow: "rgba(123,191,39,0.18)", fg: "#08080B", muted: "#5F6368",
    surface: "#F2F3F5", line: "#E3E5E8", light: true, captionWeight: 800, captionCase: "none",
  },
  {
    id: "jungle", name: "Jungle",
    bg: "#0A1F12", glow: "rgba(123,191,39,0.30)", fg: "#F5F5F7", muted: "#A8C3AE",
    surface: "#10291A", line: "#1E3D29", light: false, captionWeight: 900, captionCase: "uppercase",
  },
];

export const BRAND = { green: "#7bbf27" };

export const DECK_HEX = { red: "#FF3B30", orange: "#FF8A00", green: "#34C759", gold: "#FFD54A" } as const;
export const DECK_DEEP = { red: "#D92B21", orange: "#C05F00", green: "#1E8E3E", gold: "#B07A00" } as const;

export type Format = "vertical" | "square" | "landscape";
export const FORMATS: { id: Format; width: number; height: number }[] = [
  { id: "vertical", width: 1080, height: 1920 },
  { id: "square", width: 1080, height: 1080 },
  { id: "landscape", width: 1920, height: 1080 },
];
