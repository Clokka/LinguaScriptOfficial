// Text-to-image flashcards: one openly-licensed photo per saved word, fetched
// from Openverse via the fetch-word-image edge function and cached on
// saved_words so it's a one-time cost per word, not per review.
import { supabase } from "@/integrations/supabase/client";

export interface WordImageResult {
  url: string;
  license?: string;
  creator?: string;
}

/** Calls the edge function only — does not touch the database. */
export async function fetchWordImage(query: string): Promise<WordImageResult | null> {
  if (!query.trim()) return null;
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
export async function cacheWordImage(savedWordId: string, query: string): Promise<string | null> {
  const result = await fetchWordImage(query);
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
): Promise<void> {
  const result = await fetchWordImage(query);
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
