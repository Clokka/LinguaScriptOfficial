// Text-to-image flashcards: one openly-licensed photo per saved word, fetched
// from Openverse via the fetch-word-image edge function and cached on
// saved_words so it's a one-time cost per word, not per review.
import { supabase } from "@/integrations/supabase/client";

export interface WordImageResult {
  url: string;
  license?: string;
  creator?: string;
}

// Pictures are only for nouns you can photograph (apple, cat, plane). A
// picture search for "who", "very" or "time" returns something random (a
// creepy mask for "who"), which is worse than no picture. Nouns on this list
// are too abstract to photograph.
const NO_PICTURE = new Set([
  "i", "me", "you", "he", "him", "she", "her", "it", "we", "us", "they", "them",
  "this", "that", "these", "those", "my", "your", "his", "its", "our", "their",
  "who", "what", "which", "where", "when", "why", "how", "how many", "how much", "how is it",
  "and", "or", "but", "with", "not", "no", "yes", "very", "too", "also", "all", "both",
  "some", "a little", "a bit", "a few", "many", "much", "more", "less", "few", "so", "then",
  "already", "only", "just", "still", "again", "can", "will", "would", "should", "must",
  "be", "is", "are", "am", "have", "has", "there is", "do", "does", "at", "in", "on", "of",
  "for", "from", "by", "here", "there", "now", "today", "tomorrow", "yesterday", "time",
  "moment", "hello", "goodbye", "thank you", "thanks", "sorry", "please", "you're welcome",
  "ok", "okay", "it's okay", "no problem",
  "thing", "things", "name", "weather", "year", "month", "day", "week", "minute", "hour",
  "o'clock", "morning", "afternoon", "noon", "evening", "night", "date", "number", "age",
  "character", "letter", "word", "language", "mandarin", "chinese", "person", "people",
  "way", "idea", "problem", "question", "reason", "life", "work", "job", "love",
]);

/**
 * Whether a word gets a picture: only a noun (`pos`, from translate-word)
 * whose meaning is something you can photograph (cat, apple, plane). Unknown
 * part of speech means no picture.
 */
export function wantsPicture(meaning: string | null | undefined, pos: string | null | undefined): boolean {
  if ((pos || "").toLowerCase() !== "noun") return false;
  const m = (meaning || "")
    .toLowerCase()
    .split(/[,;/(]/)[0]
    .replace(/^(to|a|an|the)\s+/, "")
    .trim();
  if (!m) return false;
  if (/particle|measure word|classifier/.test((meaning || "").toLowerCase())) return false;
  return !NO_PICTURE.has(m);
}

/** Calls the edge function only — does not touch the database. */
export async function fetchWordImage(query: string, pos: string | null | undefined): Promise<WordImageResult | null> {
  if (!query.trim() || !wantsPicture(query, pos)) return null;
  try {
    const { data, error } = await supabase.functions.invoke("fetch-word-image", {
      body: { query },
    });
    if (error || !data?.url) return null;
    return {
      url: data.url,
      license: data.license,
      creator: data.creator,
    };
  } catch (err) {
    console.error("fetchWordImage failed:", err);
    return null;
  }
}

/**
 * Fetch + persist an image for a saved word. Safe to call repeatedly: a word
 * that already has image_url should never reach this (callers check first),
 * and a miss (no Openverse match) is cheap to retry on a later review rather
 * than something worth caching as a permanent failure.
 */
export async function cacheWordImage(savedWordId: string, query: string, pos: string | null | undefined): Promise<string | null> {
  const result = await fetchWordImage(query, pos);
  if (!result) return null;

  const attribution = result.creator ? `${result.creator} · ${result.license || "CC"}` : result.license || null;
  const { error } = await supabase
    .from("saved_words")
    .update({ image_url: result.url, image_attribution: attribution })
    .eq("id", savedWordId);
  if (error) {
    console.error("Failed to cache word image:", error);
    return null;
  }
  return result.url;
}

/**
 * Same as cacheWordImage, but for the save path: the word was just
 * upserted and we don't have its id back, only the (user, word, language)
 * key the table's unique index is built on.
 */
export async function cacheWordImageByWord(
  userId: string,
  word: string,
  language: string,
  query: string,
  pos: string | null | undefined,
): Promise<void> {
  const result = await fetchWordImage(query, pos);
  if (!result) return;

  const attribution = result.creator ? `${result.creator} · ${result.license || "CC"}` : result.license || null;
  const { error } = await supabase
    .from("saved_words")
    .update({ image_url: result.url, image_attribution: attribution })
    .eq("user_id", userId)
    .eq("word", word)
    .eq("language", language);
  if (error) console.error("Failed to cache word image:", error);
}
