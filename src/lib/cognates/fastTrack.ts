/**
 * French Fast Track: short substitution-drill lessons.
 * Each lesson = ONE everyday sentence pattern (two frames: e.g. "Je suis ___." /
 * "Tu es ___ ?") + 6 words that look like English (cognates). The learner keeps
 * the sentence and swaps one thing at a time — the word, or the frame — so the
 * structure sinks in by repetition and the words come through context.
 * Lessons go from the most-used patterns to less-used ones (ordered by hand).
 * Lesson 3 uses the hobby the learner picked in onboarding (profiles.interests).
 */

export interface FtWord {
  fr: string;
  en: string;
  /** Feminine form, when "je suis" can be said by a girl/woman. */
  fem?: string;
  /** The English → French trick, shown as a hint. */
  tip?: string;
}
export interface FtFrame { fr: string; en: string }
export interface FtLesson {
  id: string;
  title: string;
  frames: [FtFrame, FtFrame];
  words: FtWord[];
  /** Words come from the learner's hobby instead. */
  hobby?: boolean;
}

const SAME = "Same word in French";

export const FAST_TRACK: FtLesson[] = [
  {
    id: "cest", title: "C'est… — It's…",
    frames: [{ fr: "C'est ___.", en: "It's ___." }, { fr: "Ce n'est pas ___.", en: "It's not ___." }],
    words: [
      { fr: "possible", en: "possible", tip: SAME },
      { fr: "normal", en: "normal", tip: SAME },
      { fr: "important", en: "important", tip: SAME },
      { fr: "simple", en: "simple", tip: SAME },
      { fr: "différent", en: "different", tip: "Add an accent: different → différent" },
      { fr: "parfait", en: "perfect", tip: "perfect → parfait" },
    ],
  },
  {
    id: "jesuis", title: "Je suis… — I am…",
    frames: [{ fr: "Je suis ___.", en: "I'm ___." }, { fr: "Tu es ___ ?", en: "Are you ___?" }],
    words: [
      { fr: "calme", en: "calm", tip: "calm → calme" },
      { fr: "patient", fem: "patiente", en: "patient", tip: "Same word (girls add -e: patiente)" },
      { fr: "curieux", fem: "curieuse", en: "curious", tip: "-ous → -eux (girls: -euse)" },
      { fr: "nerveux", fem: "nerveuse", en: "nervous", tip: "-ous → -eux (girls: -euse)" },
      { fr: "sérieux", fem: "sérieuse", en: "serious", tip: "-ous → -eux (girls: -euse)" },
      { fr: "fatigué", fem: "fatiguée", en: "tired", tip: "Think “fatigued” → fatigué" },
    ],
  },
  {
    id: "jaime", title: "J'aime… — I like…", hobby: true,
    frames: [{ fr: "J'aime ___.", en: "I like ___." }, { fr: "Je n'aime pas ___.", en: "I don't like ___." }],
    words: [],
  },
  {
    id: "jeveux", title: "Je veux… — I want to…",
    frames: [{ fr: "Je veux ___.", en: "I want to ___." }, { fr: "Tu veux ___ ?", en: "Do you want to ___?" }],
    words: [
      { fr: "visiter", en: "visit", tip: "Doing words end in -er: visit → visiter" },
      { fr: "continuer", en: "continue", tip: "continue → continuer" },
      { fr: "commencer", en: "start", tip: "Think “commence” → commencer" },
      { fr: "réserver", en: "book (reserve)", tip: "Think “reserve” → réserver" },
      { fr: "changer", en: "change", tip: "change → changer" },
      { fr: "participer", en: "take part", tip: "Think “participate” → participer (-ate → -er)" },
    ],
  },
  {
    id: "ilya", title: "Il y a… ? — Is there…?",
    frames: [{ fr: "Il y a un ___ ici ?", en: "Is there a ___ here?" }, { fr: "Il y a un ___ près d'ici ?", en: "Is there a ___ nearby?" }],
    words: [
      { fr: "restaurant", en: "restaurant", tip: SAME },
      { fr: "hôtel", en: "hotel", tip: "Add a hat: hotel → hôtel" },
      { fr: "problème", en: "problem", tip: "problem → problème" },
      { fr: "parc", en: "park", tip: "park → parc" },
      { fr: "supermarché", en: "supermarket", tip: "market → marché" },
      { fr: "hôpital", en: "hospital", tip: "hospital → hôpital (the s became ^)" },
    ],
  },
  {
    id: "jai", title: "J'ai une… — I have a…",
    frames: [{ fr: "J'ai une ___.", en: "I have a ___." }, { fr: "Vous avez une ___ ?", en: "Do you have a ___?" }],
    words: [
      { fr: "question", en: "question", tip: SAME },
      { fr: "réservation", en: "reservation", tip: "-tion stays -tion" },
      { fr: "idée", en: "idea", tip: "idea → idée" },
      { fr: "suggestion", en: "suggestion", tip: "-tion stays -tion" },
      { fr: "allergie", en: "allergy", tip: "-y → -ie" },
      { fr: "solution", en: "solution", tip: "-tion stays -tion" },
    ],
  },
  {
    id: "jevais", title: "Je vais… — I'm going to…",
    frames: [{ fr: "Je vais ___ demain.", en: "I'm going to ___ tomorrow." }, { fr: "Je ne vais pas ___ demain.", en: "I'm not going to ___ tomorrow." }],
    words: [
      { fr: "cuisiner", en: "cook", tip: "Think “cuisine” → cuisiner" },
      { fr: "préparer", en: "prepare", tip: "prepare → préparer" },
      { fr: "voyager", en: "travel", tip: "Think “voyage” → voyager" },
      { fr: "arriver", en: "arrive", tip: "arrive → arriver" },
      { fr: "danser", en: "dance", tip: "dance → danser" },
      { fr: "étudier", en: "study", tip: "Think “student” → étudier" },
    ],
  },
  {
    id: "oui", title: "Oui, exactement — Yes, exactly",
    frames: [{ fr: "Oui, ___.", en: "Yes, ___." }, { fr: "C'est ___ ça.", en: "That's ___ it." }],
    words: [
      { fr: "exactement", en: "exactly", tip: "-ly → -ment" },
      { fr: "probablement", en: "probably", tip: "-ly → -ment" },
      { fr: "certainement", en: "certainly", tip: "-ly → -ment" },
      { fr: "évidemment", en: "obviously (evidently)", tip: "Think “evidently” → évidemment" },
      { fr: "sûrement", en: "surely", tip: "-ly → -ment" },
      { fr: "précisément", en: "precisely", tip: "-ly → -ment" },
    ],
  },
  {
    id: "tres", title: "C'est très… — It's very…",
    frames: [{ fr: "C'est très ___.", en: "It's very ___." }, { fr: "Ce n'est pas très ___.", en: "It's not very ___." }],
    words: [
      { fr: "pratique", en: "practical", tip: "-ical → -ique" },
      { fr: "typique", en: "typical", tip: "-ical → -ique" },
      { fr: "romantique", en: "romantic", tip: "-ic → -ique" },
      { fr: "logique", en: "logical", tip: "-ical → -ique" },
      { fr: "économique", en: "cheap (economical)", tip: "-ical → -ique" },
      { fr: "touristique", en: "touristy", tip: "-ic → -ique" },
    ],
  },
  {
    id: "bonne", title: "C'est une bonne… — It's a good…",
    frames: [{ fr: "C'est une bonne ___.", en: "It's a good ___." }, { fr: "C'est une ___ importante.", en: "It's an important ___." }],
    words: [
      { fr: "décision", en: "decision", tip: "-sion stays -sion" },
      { fr: "option", en: "option", tip: "-tion stays -tion" },
      { fr: "tradition", en: "tradition", tip: "-tion stays -tion" },
      { fr: "destination", en: "destination", tip: "-tion stays -tion" },
      { fr: "invention", en: "invention", tip: "-tion stays -tion" },
      { fr: "explication", en: "explanation", tip: "explain → expliquer, explanation → explication" },
    ],
  },
  {
    id: "metier", title: "Je suis artiste — I'm an artist",
    frames: [{ fr: "Je suis ___.", en: "I'm a(n) ___." }, { fr: "Mon frère est ___.", en: "My brother is a(n) ___." }],
    words: [
      { fr: "artiste", en: "artist", tip: "-ist → -iste (no “un” in French!)" },
      { fr: "journaliste", en: "journalist", tip: "-ist → -iste" },
      { fr: "dentiste", en: "dentist", tip: "-ist → -iste" },
      { fr: "touriste", en: "tourist", tip: "-ist → -iste" },
      { fr: "optimiste", en: "optimist", tip: "-ist → -iste" },
      { fr: "réaliste", en: "realist", tip: "-ist → -iste" },
    ],
  },
  {
    id: "valeurs", title: "La… est importante — … is important",
    frames: [{ fr: "La ___ est importante.", en: "___ is important." }, { fr: "Pour moi, la ___ est importante.", en: "For me, ___ is important." }],
    words: [
      { fr: "sécurité", en: "safety (security)", tip: "-ty → -té" },
      { fr: "qualité", en: "quality", tip: "-ty → -té" },
      { fr: "liberté", en: "freedom (liberty)", tip: "-ty → -té" },
      { fr: "créativité", en: "creativity", tip: "-ty → -té" },
      { fr: "communication", en: "communication", tip: "-tion stays -tion" },
      { fr: "nature", en: "nature", tip: SAME },
    ],
  },
  {
    id: "jadore", title: "J'adore ce… — I love this…",
    frames: [{ fr: "J'adore ce ___.", en: "I love this ___." }, { fr: "Je n'aime pas ce ___.", en: "I don't like this ___." }],
    words: [
      { fr: "film", en: "film", tip: SAME },
      { fr: "restaurant", en: "restaurant", tip: SAME },
      { fr: "sport", en: "sport", tip: SAME },
      { fr: "café", en: "café", tip: SAME },
      { fr: "moment", en: "moment", tip: SAME },
      { fr: "parfum", en: "perfume", tip: "perfume → parfum" },
    ],
  },
];

/** "J'aime ___" words for each onboarding hobby (src/lib/interests.ts ids). */
export const HOBBY_WORDS: Record<string, FtWord[]> = {
  default: [
    { fr: "la musique", en: "music" }, { fr: "le cinéma", en: "the cinema" }, { fr: "le sport", en: "sport" },
    { fr: "la nature", en: "nature" }, { fr: "le chocolat", en: "chocolate" }, { fr: "la culture", en: "culture" },
  ],
  gaming: [
    { fr: "les jeux vidéo", en: "video games" }, { fr: "la stratégie", en: "strategy" }, { fr: "l'action", en: "action" },
    { fr: "l'aventure", en: "adventure" }, { fr: "la compétition", en: "competition" }, { fr: "le streaming", en: "streaming" },
  ],
  football: [
    { fr: "le football", en: "football" }, { fr: "le sport", en: "sport" }, { fr: "les matchs", en: "matches" },
    { fr: "la compétition", en: "competition" }, { fr: "les stades", en: "stadiums" }, { fr: "l'action", en: "action" },
  ],
  fitness: [
    { fr: "le sport", en: "sport" }, { fr: "le yoga", en: "yoga" }, { fr: "le jogging", en: "jogging" },
    { fr: "le fitness", en: "fitness" }, { fr: "la gym", en: "the gym" }, { fr: "l'exercice", en: "exercise" },
  ],
  travel: [
    { fr: "les voyages", en: "travel (voyages)" }, { fr: "l'aventure", en: "adventure" }, { fr: "la nature", en: "nature" },
    { fr: "les hôtels", en: "hotels" }, { fr: "la culture", en: "culture" }, { fr: "les musées", en: "museums" },
  ],
  cooking: [
    { fr: "la cuisine", en: "cooking (cuisine)" }, { fr: "le chocolat", en: "chocolate" }, { fr: "la salade", en: "salad" },
    { fr: "les desserts", en: "desserts" }, { fr: "les fruits", en: "fruit" }, { fr: "la pizza", en: "pizza" },
  ],
  music: [
    { fr: "la musique", en: "music" }, { fr: "le piano", en: "the piano" }, { fr: "la guitare", en: "the guitar" },
    { fr: "les concerts", en: "concerts" }, { fr: "le rock", en: "rock" }, { fr: "le jazz", en: "jazz" },
  ],
  films: [
    { fr: "le cinéma", en: "the cinema" }, { fr: "les films", en: "films" }, { fr: "les documentaires", en: "documentaries" },
    { fr: "la comédie", en: "comedy" }, { fr: "les séries", en: "series" }, { fr: "l'action", en: "action" },
  ],
  comedy: [
    { fr: "la comédie", en: "comedy" }, { fr: "l'humour", en: "humour" }, { fr: "le théâtre", en: "the theatre" },
    { fr: "l'ironie", en: "irony" }, { fr: "le cinéma", en: "the cinema" }, { fr: "les films comiques", en: "comic films" },
  ],
  history: [
    { fr: "l'histoire", en: "history" }, { fr: "les musées", en: "museums" }, { fr: "l'architecture", en: "architecture" },
    { fr: "les monuments", en: "monuments" }, { fr: "la politique", en: "politics" }, { fr: "les civilisations", en: "civilisations" },
  ],
  business: [
    { fr: "le business", en: "business" }, { fr: "le marketing", en: "marketing" }, { fr: "l'économie", en: "the economy" },
    { fr: "la finance", en: "finance" }, { fr: "la stratégie", en: "strategy" }, { fr: "les négociations", en: "negotiations" },
  ],
  news: [
    { fr: "les informations", en: "the news" }, { fr: "la politique", en: "politics" }, { fr: "l'économie", en: "the economy" },
    { fr: "la science", en: "science" }, { fr: "la technologie", en: "technology" }, { fr: "le journalisme", en: "journalism" },
  ],
  podcasts: [
    { fr: "les podcasts", en: "podcasts" }, { fr: "les interviews", en: "interviews" }, { fr: "la radio", en: "the radio" },
    { fr: "les débats", en: "debates" }, { fr: "la philosophie", en: "philosophy" }, { fr: "la psychologie", en: "psychology" },
  ],
  cars: [
    { fr: "l'automobile", en: "cars (the automobile)" }, { fr: "les moteurs", en: "engines (motors)" }, { fr: "la mécanique", en: "mechanics" },
    { fr: "les circuits", en: "race tracks (circuits)" }, { fr: "la Formule 1", en: "Formula 1" }, { fr: "le design", en: "design" },
  ],
  art: [
    { fr: "l'art", en: "art" }, { fr: "le design", en: "design" }, { fr: "la photographie", en: "photography" },
    { fr: "la sculpture", en: "sculpture" }, { fr: "l'architecture", en: "architecture" }, { fr: "les couleurs", en: "colours" },
  ],
  culture: [
    { fr: "la culture", en: "culture" }, { fr: "les traditions", en: "traditions" }, { fr: "la cuisine", en: "cooking (cuisine)" },
    { fr: "la musique", en: "music" }, { fr: "l'histoire", en: "history" }, { fr: "la littérature", en: "literature" },
  ],
  language: [
    { fr: "les langues", en: "languages" }, { fr: "la grammaire", en: "grammar" }, { fr: "le vocabulaire", en: "vocabulary" },
    { fr: "la conversation", en: "conversation" }, { fr: "la prononciation", en: "pronunciation" }, { fr: "la littérature", en: "literature" },
  ],
  tech: [
    { fr: "la technologie", en: "technology" }, { fr: "les applications", en: "apps (applications)" }, { fr: "les robots", en: "robots" },
    { fr: "la science", en: "science" }, { fr: "l'innovation", en: "innovation" }, { fr: "les vidéos", en: "videos" },
  ],
  entrepreneurship: [
    { fr: "le business", en: "business" }, { fr: "l'innovation", en: "innovation" }, { fr: "le marketing", en: "marketing" },
    { fr: "la stratégie", en: "strategy" }, { fr: "la finance", en: "finance" }, { fr: "les projets", en: "projects" },
  ],
  anime: [
    { fr: "les animés", en: "anime" }, { fr: "les mangas", en: "manga" }, { fr: "l'animation", en: "animation" },
    { fr: "l'action", en: "action" }, { fr: "l'aventure", en: "adventure" }, { fr: "la culture japonaise", en: "Japanese culture" },
  ],
};

export function lessonWords(lesson: FtLesson, hobby: string | null): FtWord[] {
  if (!lesson.hobby) return lesson.words;
  return HOBBY_WORDS[hobby || ""] || HOBBY_WORDS.default;
}

/** first = listen & type; word / frame = swap one thing; again = a missed one, listen & type. */
export type FtPrompt = { word: number; frame: 0 | 1; cue: "first" | "word" | "frame" | "again" };

/**
 * ~12 swaps per lesson. Swap the word a few times, then swap the frame,
 * then mix — so both the words AND the sentence pattern are repeated.
 */
export function lessonPlan(n = 6): FtPrompt[] {
  const P = (word: number, frame: 0 | 1, cue: FtPrompt["cue"]): FtPrompt => ({ word, frame, cue });
  if (n < 6) return Array.from({ length: n }, (_, i) => P(i, 0, i ? "word" : "first"));
  return [
    P(0, 0, "first"), P(1, 0, "word"), P(2, 0, "word"),
    P(2, 1, "frame"), P(3, 1, "word"), P(4, 1, "word"),
    P(4, 0, "frame"), P(5, 0, "word"), P(0, 0, "word"),
    P(0, 1, "frame"), P(1, 1, "word"), P(3, 1, "word"), P(5, 1, "word"),
  ];
}

/** The French sentence, and the accepted answers (masculine + feminine). */
export function sentenceFor(frame: FtFrame, w: FtWord): { text: string; accept: string[] } {
  const text = frame.fr.replace("___", w.fr);
  const accept = [text];
  if (w.fem) accept.push(frame.fr.replace("___", w.fem));
  return { text, accept };
}
