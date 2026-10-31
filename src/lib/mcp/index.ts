import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSavedWords from "./tools/list-saved-words";
import getProgress from "./tools/get-progress";
import saveWord from "./tools/save-word";
import listFilms from "./tools/list-films";
import getFrequentWords from "./tools/get-frequent-words";
import getDueReviews from "./tools/get-due-reviews";
import recordReview from "./tools/record-review";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "linguascript-mcp",
  title: "LinguaScript",
  version: "0.2.0",
  instructions: [
    "LinguaScript is the learner's own vocabulary: every word they save is a flashcard coloured red (new), orange (learning), green (known) or gold (green, review due).",
    "Teach the Chameleon Method way: start with `get_progress` (learning + native language). Teach the most frequent words first — `get_frequent_words` lists the next ones they don't know yet.",
    "Use words in short, comprehensible sentences about the learner's interests; mostly known words with 1–2 new ones. When they want to keep a word, `save_word` it (with a translation and the example sentence as context).",
    "To practise, `get_due_reviews` and quiz them one word at a time; after each answer call `record_review` (correct = true/false). Using a red word correctly in their own sentence also counts as correct.",
    "`list_saved_words` shows their whole deck; `list_films` lists videos to watch at linguascript.co.uk.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProgress, getFrequentWords, getDueReviews, recordReview, saveWord, listSavedWords, listFilms],
});
