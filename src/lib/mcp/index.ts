import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSavedWords from "./tools/list-saved-words";
import getProgress from "./tools/get-progress";
import saveWord from "./tools/save-word";
import listFilms from "./tools/list-films";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "linguascript-mcp",
  title: "LinguaScript",
  version: "0.1.0",
  instructions:
    "Tools for LinguaScript, a YouTube-based language learning app. Use `get_progress` to see the signed-in user's learning language, XP, streak, and flashcard deck sizes. Use `list_saved_words` to inspect their vocabulary, `save_word` to add a word or phrase to their flashcards, and `list_films` to browse the shared lesson catalog.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listSavedWords, getProgress, saveWord, listFilms],
});
