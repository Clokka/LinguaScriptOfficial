/**
 * The Chameleon Quest — the core rewatch loop.
 *
 *   1. The learner picks ONE video that fits their level.
 *   2. They rewatch it over the week. Every word in it is a tile that goes
 *      red → orange → green (with a gold flash when a word is newly earned).
 *   3. When every word is green the video is mastered: they level up and
 *      the rest of the catalog unlocks so they can pick the next one.
 *
 * Why lock everything else: watching lots of unrelated films scatters
 * progress across words that never connect. Rewatching one comprehensible
 * video lets the learner literally watch themselves adapt to it.
 *
 * The quest lives in browser storage for now (per user + learning language).
 * Word colours always come from the real deck, so nothing here can drift
 * from saved_words.
 */
import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { fetchSubtitleTokens } from "@/lib/videoComprehension";
import { loadDeckIndex, type DeckState } from "@/lib/vocab";
import { isPendingGreen } from "@/lib/goldenReveal";

export type TileState = DeckState | "gold";

export interface WordTile {
  word: string;
  state: TileState;
}

export interface ChameleonQuest {
  filmId: string;
  title: string;
  thumbnailUrl: string | null;
  startedAt: string;
  /** Set once every word has turned green. Content unlocks from here. */
  masteredAt: string | null;
}

export interface WordMapSummary {
  total: number;
  green: number;
  gold: number;
  orange: number;
  red: number;
  /** Words still to turn green (red + orange). */
  left: number;
  mastered: boolean;
}

const QUEST_KEY = "linguascript.chameleonQuest.v1";
const MASTERED_KEY = "linguascript.chameleonMastered.v1";
const SNAP_KEY = "linguascript.chameleonSnap.v1";
const CHANGE_EVENT = "chameleon-quest-change";

const scope = (userId: string | null, language: string) =>
  `${userId ?? "guest"}:${(language || "").toLowerCase()}`;

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* storage blocked — the quest just won't persist */ }
}

// ── Quest state ─────────────────────────────────────────────────────────────

export function getQuest(userId: string | null, language: string): ChameleonQuest | null {
  return readJson<Record<string, ChameleonQuest>>(QUEST_KEY, {})[scope(userId, language)] ?? null;
}

function setQuest(userId: string | null, language: string, quest: ChameleonQuest | null) {
  const all = readJson<Record<string, ChameleonQuest>>(QUEST_KEY, {});
  if (quest) all[scope(userId, language)] = quest;
  else delete all[scope(userId, language)];
  writeJson(QUEST_KEY, all);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function startQuest(
  userId: string | null,
  language: string,
  film: { id: string; title: string; thumbnail_url?: string | null },
) {
  setQuest(userId, language, {
    filmId: film.id,
    title: film.title,
    thumbnailUrl: film.thumbnail_url ?? null,
    startedAt: new Date().toISOString(),
    masteredAt: null,
  });
}

/** Mark the current quest mastered. Returns true only the first time. */
export function completeQuest(userId: string | null, language: string): boolean {
  const q = getQuest(userId, language);
  if (!q || q.masteredAt) return false;
  const masteredAt = new Date().toISOString();
  const done = readJson<Record<string, string[]>>(MASTERED_KEY, {});
  const k = scope(userId, language);
  done[k] = Array.from(new Set([...(done[k] ?? []), q.filmId]));
  writeJson(MASTERED_KEY, done);
  setQuest(userId, language, { ...q, masteredAt });
  return true;
}

export function clearQuest(userId: string | null, language: string) {
  setQuest(userId, language, null);
}

export function masteredFilmIds(userId: string | null, language: string): string[] {
  return readJson<Record<string, string[]>>(MASTERED_KEY, {})[scope(userId, language)] ?? [];
}

/** True when this film is blocked because a different quest is in progress. */
export function isLockedByQuest(quest: ChameleonQuest | null, filmId: string): boolean {
  return !!quest && !quest.masteredAt && quest.filmId !== filmId;
}

/** Live quest for the current user + language; updates across components. */
export function useChameleonQuest(userId: string | null, language: string) {
  const [quest, setQ] = useState<ChameleonQuest | null>(() => getQuest(userId, language));
  useEffect(() => {
    const sync = () => setQ(getQuest(userId, language));
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [userId, language]);

  const start = useCallback(
    (film: { id: string; title: string; thumbnail_url?: string | null }) => startQuest(userId, language, film),
    [userId, language],
  );
  const complete = useCallback(() => completeQuest(userId, language), [userId, language]);
  const clear = useCallback(() => clearQuest(userId, language), [userId, language]);

  return { quest, start, complete, clear };
}

// ── Word map ────────────────────────────────────────────────────────────────

/**
 * Every distinct word in the video, in the order it is first heard, coloured
 * by the learner's deck. Gold = green but not yet seen to turn green.
 */
export async function loadVideoWordMap(
  userId: string | null,
  filmId: string,
  language: string,
): Promise<WordTile[]> {
  const [tokens, deck] = await Promise.all([
    fetchSubtitleTokens(filmId, language),
    loadDeckIndex(userId, language),
  ]);
  const seen = new Set<string>();
  const tiles: WordTile[] = [];
  for (const word of tokens) {
    if (seen.has(word)) continue;
    seen.add(word);
    const entry = deck.get(word);
    const state: TileState = isPendingGreen(entry) ? "gold" : entry?.state ?? "red";
    tiles.push({ word, state });
  }
  return tiles;
}

export function summarizeWordMap(tiles: WordTile[]): WordMapSummary {
  const s = { total: tiles.length, green: 0, gold: 0, orange: 0, red: 0 };
  for (const t of tiles) s[t.state]++;
  const left = s.orange + s.red;
  return { ...s, left, mastered: s.total > 0 && left === 0 };
}

/**
 * The colours the learner last saw for a film's words. Showing a map animates
 * from these to the current colours, so every rewatch (or flashcard session)
 * ends with tiles visibly flipping — the chameleon adapting.
 */
export function loadSnapshot(filmId: string): Record<string, TileState> {
  return readJson<Record<string, Record<string, TileState>>>(SNAP_KEY, {})[filmId] ?? {};
}

export function saveSnapshot(filmId: string, tiles: WordTile[]) {
  const all = readJson<Record<string, Record<string, TileState>>>(SNAP_KEY, {});
  // Keep storage small: only the most recent few films need a "before".
  delete all[filmId];
  for (const old of Object.keys(all).slice(0, -9)) delete all[old];
  // Gold is a one-off reward moment; remember it as green so it isn't replayed.
  all[filmId] = Object.fromEntries(tiles.map((t) => [t.word, t.state === "gold" ? "green" : t.state]));
  writeJson(SNAP_KEY, all);
}

/** Word map for one film, reloaded whenever the film or deck owner changes. */
export function useVideoWordMap(userId: string | null, filmId: string | null, language: string, reloadKey = 0) {
  const [tiles, setTiles] = useState<WordTile[] | null>(null);
  useEffect(() => {
    if (!filmId) { setTiles(null); return; }
    let alive = true;
    setTiles(null);
    loadVideoWordMap(userId, filmId, language).then((t) => { if (alive) setTiles(t); });
    return () => { alive = false; };
  }, [userId, filmId, language, reloadKey]);
  return tiles;
}

export function celebrateMastery() {
  void confetti({
    particleCount: 160,
    spread: 100,
    origin: { y: 0.6 },
    colors: ["#34d399", "#FFD54A", "#6ee7b7", "#fb923c"],
    disableForReducedMotion: true,
  });
}
