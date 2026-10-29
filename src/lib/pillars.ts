/**
 * The Chameleon Method — shared data for pillars 2 (✍️ writing) and 3 (🗣️ speaking).
 *
 * Inspired by Kató Lomb's three pillars:
 *   autolexia  📖🎬 reading + watching (input)  → the player and the extension
 *   autographia ✍️ writing                     → /write  (LinguaScripts)
 *   autologia  🗣️ speaking                     → /speak  (3-minute challenge)
 *
 * Every word you save while reading or watching starts RED. Writing and
 * speaking are where you USE those red words; using one correctly counts as a
 * review and moves it along red → orange → green.
 */
import { supabase } from "@/integrations/supabase/client";
import { applySrsReview, isDueGold, nextState, normalizeToken, type DeckState } from "@/lib/vocab";
import { interestById } from "@/lib/interests";

export type WordColour = DeckState | "gold";

export interface PillarWord {
  id: string;
  word: string;
  translation: string | null;
  state: DeckState;
  next_review: string | null;
  interval_days: number | null;
  review_count: number | null;
  ease_factor: number | null;
  times_correct: number | null;
  state_changed_at?: string | null;
  created_at: string | null;
}

export interface PillarDeck {
  /** Newest red words first — the ones to practise. */
  red: PillarWord[];
  /** normalized word → colour, for every saved word. */
  colours: Map<string, WordColour>;
  /** normalized → row, for promoting a word after it's used. */
  byKey: Map<string, PillarWord>;
  /** Top high-frequency words for this language — always green when spoken. */
  common: Set<string>;
  /** A sample of known words to build sentences from. */
  greenSample: string[];
}

const COLS = "id, word, translation, state, next_review, interval_days, review_count, ease_factor, times_correct, state_changed_at, created_at";

export async function loadPillarDeck(userId: string, language: string): Promise<PillarDeck> {
  const colours = new Map<string, WordColour>();
  const byKey = new Map<string, PillarWord>();
  const all: PillarWord[] = [];
  for (let from = 0; from < 10000; from += 1000) {
    const { data, error } = await supabase
      .from("saved_words")
      .select(COLS)
      .eq("user_id", userId)
      .eq("language", language)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) { console.error("[pillars] deck", error); break; }
    const rows = (data || []) as any[];
    for (const r of rows) {
      const w: PillarWord = { ...r, state: r.state === "green" ? "green" : r.state === "orange" ? "orange" : "red" };
      all.push(w);
      const key = normalizeToken(w.word);
      if (!key || byKey.has(key)) continue;
      byKey.set(key, w);
      colours.set(key, isDueGold(w) ? "gold" : w.state);
    }
    if (rows.length < 1000) break;
  }

  const common = new Set<string>();
  const { data: cv } = await supabase
    .from("core_vocabulary" as any)
    .select("word, rank")
    .eq("language", language)
    .order("rank", { ascending: true })
    .limit(1000);
  for (const r of (cv || []) as any[]) {
    const k = normalizeToken(String(r.word || ""));
    if (k && !/\s/.test(k)) common.add(k);
  }

  const greenSaved = all.filter((w) => w.state === "green").map((w) => w.word);
  const greenSample = Array.from(new Set([...greenSaved.slice(0, 20), ...Array.from(common).slice(0, 120)])).slice(0, 60);

  return {
    red: all.filter((w) => w.state === "red"),
    colours,
    byKey,
    common,
    greenSample,
  };
}

/** The colour a word shows while writing or speaking. Common words are green. */
export function colourOf(deck: PillarDeck | null, raw: string): WordColour | null {
  if (!deck) return null;
  const key = normalizeToken(raw);
  if (!key) return null;
  return deck.colours.get(key) ?? (deck.common.has(key) ? "green" : null);
}

/** Split text into word / non-word pieces, keeping every character. */
export function tokenize(text: string): { text: string; word: boolean }[] {
  const out: { text: string; word: boolean }[] = [];
  const re = /[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), word: false });
    out.push({ text: m[0], word: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false });
  return out;
}

/** True when `text` contains `word` as a whole word (or as a phrase). */
export function usesWord(text: string, word: string): boolean {
  const key = normalizeToken(word);
  if (!key) return false;
  const t = normalizeToken(text.replace(/\s+/g, " "));
  if (/\s/.test(key)) return t.includes(key);
  return tokenize(text).some((p) => p.word && normalizeToken(p.text) === key);
}

/**
 * The learner used this word for real (wrote it correctly / said it): count it
 * as a correct review. red → orange → green, and the review ladder moves on.
 * Returns the new state.
 */
export async function promoteUsedWord(userId: string, w: PillarWord): Promise<DeckState> {
  const newState = nextState(w.state, (w.times_correct ?? 0) + 1, true);
  const srs = applySrsReview(w, true, { wasGreen: w.state === "green", isGreen: newState === "green" });
  const patch: Record<string, unknown> = { state: newState, times_correct: (w.times_correct ?? 0) + 1, ...srs };
  if (newState !== w.state) patch.state_changed_at = new Date().toISOString();
  const { error } = await supabase.from("saved_words").update(patch as any).eq("id", w.id).eq("user_id", userId);
  if (error) console.error("[pillars] promote", error);
  return newState;
}

export interface Me {
  nativeLanguage: string;
  interests: string[];
  goal: string | null;
}

export async function loadMe(userId: string): Promise<Me> {
  const { data } = await supabase
    .from("profiles")
    .select("native_language, interests, learning_goal")
    .eq("user_id", userId)
    .maybeSingle();
  const d = (data || {}) as any;
  return {
    nativeLanguage: d.native_language || "en",
    interests: Array.isArray(d.interests) && d.interests.length ? d.interests : ["travel"],
    goal: d.learning_goal || null,
  };
}

/** Labels for a hobby chip. */
export function hobby(id: string): { emoji: string; label: string } {
  const i = interestById(id);
  return { emoji: i?.emoji || "🌍", label: i?.label || id };
}

/** The one personal question we ask once per hobby, so LinguaScripts are about YOU. */
export const ABOUT_QUESTION: Record<string, string> = {
  travel: "Where are you going?",
  football: "Your team?",
  gaming: "Favourite game?",
  fitness: "Your sport?",
  cooking: "Favourite dish?",
  music: "Favourite artist?",
  films: "Favourite film or show?",
  anime: "Favourite anime?",
  business: "What's your business?",
  entrepreneurship: "What are you building?",
  cars: "Dream car?",
  tech: "Favourite gadget?",
  history: "Favourite period?",
  art: "What do you make?",
};

// ── Small on-device memory (per learner, per browser) ─────────────────────────
const safe = {
  get<T>(k: string, fallback: T): T {
    try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
  },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};

export const getAbout = (interest: string) => safe.get<string>(`ls.about.${interest}`, "");
export const setAbout = (interest: string, v: string) => safe.set(`ls.about.${interest}`, v.trim());

export interface SavedLinguaScript {
  text: string;
  translation: string;
  words: string[];
  interest: string;
  score: number;
  at: string;
}
export const getMyLinguaScripts = (lang: string) => safe.get<SavedLinguaScript[]>(`ls.mine.${lang}`, []);
export function saveMyLinguaScript(lang: string, s: SavedLinguaScript) {
  safe.set(`ls.mine.${lang}`, [s, ...getMyLinguaScripts(lang)].slice(0, 100));
}

export interface SpeakRun { seconds: number; target: number; words: number; redUsed: string[]; at: string }
export const getSpeakRuns = (lang: string) => safe.get<SpeakRun[]>(`ls.speak.${lang}`, []);
export function saveSpeakRun(lang: string, r: SpeakRun) {
  safe.set(`ls.speak.${lang}`, [r, ...getSpeakRuns(lang)].slice(0, 60));
}

// ── AI: compose a LinguaScript, then check what the learner wrote ──────────────
export interface Composed { prompt: string; linguascript: string; translation: string }
export interface Checked { score: number; usedWords: string[]; feedback: string; corrected: string; translation: string }

interface ComposeArgs {
  language: string;
  nativeLanguage: string;
  redWords: { word: string; translation?: string | null }[];
  greenWords: string[];
  interest: string;
  about: string;
}

export async function composeLinguaScript(a: ComposeArgs): Promise<Composed | null> {
  const { data, error } = await supabase.functions.invoke("linguascript-write", {
    body: { mode: "compose", ...a, greenWords: a.greenWords.map((word) => ({ word })) },
  });
  if (!error && data?.linguascript) return data as Composed;
  // Older backend: fall back to the single-word sentence generator.
  const first = a.redWords[0];
  const { data: d2 } = await supabase.functions.invoke("generate-personalized-linguascript", {
    body: {
      word: first.word, translation: first.translation || first.word, interests: [a.interest], cefLevel: "A2",
      language: a.language, wordState: "red", nativeLanguage: a.nativeLanguage,
    },
  });
  if (d2?.sentence) return { prompt: "", linguascript: d2.sentence, translation: d2.nativeTranslation || d2.englishTranslation || "" };
  return null;
}

export async function checkLinguaScript(a: ComposeArgs & { text: string }): Promise<Checked | null> {
  const { data, error } = await supabase.functions.invoke("linguascript-write", {
    body: { mode: "check", ...a, greenWords: [] },
  });
  if (!error && typeof data?.score === "number") return data as Checked;
  // Older backend: the per-word evaluator.
  const { data: d2 } = await supabase.functions.invoke("evaluate-linguascripts", {
    body: { sentences: [{ word: a.redWords.map((w) => w.word).join(" + "), text: a.text }], language: a.language, nativeLanguage: a.nativeLanguage },
  });
  const r = Array.isArray(d2) ? d2[0] : d2?.results?.[0] ?? d2?.[0];
  if (!r) return null;
  return {
    score: Number(r.score) || 0,
    usedWords: a.redWords.filter((w) => usesWord(a.text, w.word)).map((w) => w.word),
    feedback: r.feedback || "",
    corrected: a.text,
    translation: "",
  };
}

/** Pick the 1–2 red words for the next LinguaScript (newest first, rotating). */
export function pickRedPair(red: PillarWord[], round: number): PillarWord[] {
  if (red.length === 0) return [];
  const pool = red.slice(0, 12);
  const a = pool[(round * 2) % pool.length];
  const b = pool[(round * 2 + 1) % pool.length];
  return pool.length > 1 && round % 3 !== 2 && a.id !== b.id ? [a, b] : [a];
}

export const COLOUR_HEX: Record<WordColour, string> = {
  red: "#FF3B30",
  orange: "#FF8A00",
  green: "#34C759",
  gold: "#FFD54A",
};
