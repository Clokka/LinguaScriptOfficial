/**
 * The video word map: every word in a video as a tile coloured by the
 * learner's deck (red → orange → green, gold when newly earned). Each time a
 * map is shown, tiles flip from the colours seen last time to their current
 * ones, so a rewatch ends with the learner watching themselves adapt.
 *
 * Word colours always come from the real deck, so nothing here can drift
 * from saved_words. Only the "last seen" snapshot lives in browser storage.
 */
import { useEffect, useState } from "react";
import { fetchSubtitleTokens } from "@/lib/videoComprehension";
import { loadDeckIndex, type DeckState } from "@/lib/vocab";
import { isPendingGreen } from "@/lib/goldenReveal";

export type TileState = DeckState | "gold";

export interface WordTile {
  word: string;
  state: TileState;
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

const SNAP_KEY = "linguascript.chameleonSnap.v1";

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
  } catch { /* storage blocked — tiles just won't animate from last time */ }
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
