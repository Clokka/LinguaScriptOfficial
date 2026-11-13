// "Everything in A1": one row per thing the A1 guide covers, for the hub summary.
// Grammar rows come straight from UNITS, so the summary can never miss a unit.
import { UNITS, isReady } from "./grammar";
import { A1_WORD_RANGE } from "./progress";

export type FeatureStatus = "ready" | "partial" | "soon";
export interface Feature { area: string; item: string; status: FeatureStatus; to?: string; note?: string }

export const A1_FEATURES: Feature[] = [
  { area: "Vocabulary", item: `About ${A1_WORD_RANGE} words in 15 everyday topics`, status: "partial", to: "/english/a1/words", note: "First 100 (most common) ready" },
  { area: "Everyday basics", item: "Alphabet and spelling, numbers to 100, telling the time, days, months and dates, prices, greetings", status: "partial", to: "/english/a1/checklist", note: "Time and prices in the practice test" },
  ...UNITS.map((u): Feature => ({
    area: "Grammar",
    item: u.slug === "can-cant" ? `Modal verbs: ${u.title}` : u.title,
    status: isReady(u) ? "ready" : "soon",
    to: isReady(u) ? `/english/a1/grammar/${u.slug}` : "/english/a1/grammar",
  })),
  { area: "Listening", item: "Numbers, prices, times, directions and slow, simple questions", status: "partial", to: "/english/a1/test", note: "In the practice test" },
  { area: "Reading", item: "Signs, short messages, simple forms and adverts", status: "partial", to: "/english/a1/test", note: "In the practice test" },
  { area: "Speaking", item: "Introduce yourself, describe family and home, likes, abilities and your day", status: "soon", to: "/english/a1/checklist" },
  { area: "Conversation", item: "Personal questions, ordering and prices, asking to repeat, arranging a time", status: "soon", to: "/english/a1/checklist" },
  { area: "Writing", item: "Fill in a form, write a short message (25–35 words), sentences about yourself", status: "soon", to: "/english/a1/checklist" },
  { area: "Pronunciation", item: "Hear every example and word in clear English", status: "partial", note: "Listen buttons ready, lessons coming" },
  { area: "Checklist", item: "Tick off every A1 \"I can…\" skill", status: "ready", to: "/english/a1/checklist" },
  { area: "Practice test", item: "20 questions: grammar, vocabulary, reading, listening, with score by skill", status: "ready", to: "/english/a1/test" },
];
