/**
 * Guest-mode flashcard storage.
 *
 * During onboarding (and any other unauthenticated use), saved words live in
 * localStorage so the user can experience flashcards without a sign-in wall.
 * Once they sign in, `migrateGuestWords` flushes the local list into Supabase.
 */
import { supabase } from "@/integrations/supabase/client";

export interface GuestWord {
  id: string;
  word: string;
  translation: string;
  pronunciation: string;
  ipa: string;
  context: string;
  language: string;
  next_review: string;
  review_count: number;
  created_at: string;
}

const KEY = "linguascript.guestWords";

const read = (): GuestWord[] => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as GuestWord[]) : [];
  } catch {
    return [];
  }
};

const write = (words: GuestWord[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(words));
  } catch {
    /* quota — ignore */
  }
};

export const getGuestWords = (): GuestWord[] => read();

export const saveGuestWord = (
  input: Omit<GuestWord, "id" | "next_review" | "review_count" | "created_at">,
): GuestWord => {
  const list = read();
  const existing = list.find(
    (w) => w.word.toLowerCase() === input.word.toLowerCase() && w.language === input.language,
  );
  if (existing) {
    Object.assign(existing, input);
    write(list);
    return existing;
  }
  const today = new Date().toISOString().split("T")[0];
  const entry: GuestWord = {
    ...input,
    id: `guest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    next_review: today,
    review_count: 0,
    created_at: new Date().toISOString(),
  };
  list.unshift(entry);
  write(list);
  return entry;
};

export const clearGuestWords = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
};

/** Upload guest words into the user's account after sign-in. */
export const migrateGuestWords = async (userId: string) => {
  const list = read();
  if (!list.length) return;
  const rows = list.map((w) => ({
    user_id: userId,
    word: w.word,
    translation: w.translation,
    pronunciation: w.pronunciation,
    ipa: w.ipa,
    context: w.context,
    language: w.language,
  }));
  const { error } = await supabase
    .from("saved_words")
    .upsert(rows, { onConflict: "user_id,word,language" });
  if (!error) clearGuestWords();
};
