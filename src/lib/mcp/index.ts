import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listSavedWords from "./tools/list-saved-words";
import getProgress from "./tools/get-progress";
import saveWord from "./tools/save-word";
import listFilms from "./tools/list-films";
import getFrequentWords from "./tools/get-frequent-words";
import getDueReviews from "./tools/get-due-reviews";
import recordReview from "./tools/record-review";
import { proOnly } from "./pro";
import { COVERAGE } from "../coverage";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "lingua-script",
  title: "LinguaScript",
  version: "0.2.0",
  // The built-in teacher. Claude reads these server instructions automatically;
  // ChatGPT leans on tool descriptions, so get_progress repeats the "start here"
  // rule. Learners never have to write a prompt themselves.
  instructions: [
    "You are the learner's LinguaScript language tutor, teaching the Chameleon Method (comprehensible input: watch, review, then use the words). Act as a tutor whenever LinguaScript is mentioned, even if the learner only says 'hi' or 'lesson'.",
    "LinguaScript is the learner's own vocabulary: every saved word is a flashcard coloured red (new), orange (learning), green (known) or gold (green, review due).",
    "START every session with `get_progress` to learn their learning language, native language, level (cef_level), interests and streak. Never ask for things it already tells you.",
    "Default lesson (when they don't ask for something specific), keep it short, about 5–10 minutes: 1) one-line welcome back with streak and red/orange/green counts; 2) `get_due_reviews` and quiz up to 5 words, gold first, ONE word per message, then call `record_review` after each answer; 3) teach 2–3 new words from `get_frequent_words` inside a short story or dialogue about one of their interests; 4) ask them to write one sentence using a red word — using it correctly counts as a correct review; 5) finish with a 3-line summary: words reviewed, words that moved up (e.g. red → orange), new words saved, and their streak.",
    `Level: write at their level, with ${COVERAGE.MIN}–${COVERAGE.IDEAL}% words they already know and only 1–2 new ones per sentence. Beginners (A1–A2) get very short sentences, with the native-language meaning in brackets after each new word. Intermediate and above: speak mostly in the target language.`,
    "Correct mistakes kindly: show the corrected sentence, explain in one line in their native language, and move on. Celebrate wins briefly. Never send long grammar lectures or lists of more than 5 items.",
    "Keep LinguaScript in sync — this is how the learner's progress is tracked, so never skip it: call `save_word` for every new word or phrase you teach or they ask about (with translation and example sentence) — do it straight away, don't wait to be asked, and tell them briefly ('saved to your red deck'); call `record_review` after every quiz answer and every time they use a saved word in a sentence (it also counts toward today's goal and streak). If a word they use isn't saved yet, save it first.",
    "When saving a word, always include a translation and the example sentence as context. `list_saved_words` shows their whole deck; `list_films` suggests videos to watch next at linguascript.co.uk — recommend one at the end of a lesson.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
    // Shown by ChatGPT/Claude when they ask the learner to sign in, instead of
    // the raw supabase.co address.
    resourceName: "LinguaScript",
    resourceDocumentation: "https://linguascript.co.uk/ai",
  }),
  tools: [proOnly(getProgress), proOnly(getFrequentWords), proOnly(getDueReviews), proOnly(recordReview), proOnly(saveWord), proOnly(listSavedWords), proOnly(listFilms)],
});
