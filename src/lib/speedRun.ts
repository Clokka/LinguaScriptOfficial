/**
 * Speed Run — five tiny courses that teach the most frequent words first.
 *
 * Course k ends at the word that takes the learner to k × 10% of the words
 * heard in real films and TV. The cut points are MEASURED per language by
 * scripts/measure-speed-run-cuts.ts from the very list core_vocabulary is
 * seeded from (hermitdave/FrequencyWords, OpenSubtitles 2018, surface forms),
 * so "course 1" is exactly the first N rows of core_vocabulary. Re-run the
 * script to change them; never guess. Example: French needs 5 words (de, je,
 * est, pas, le) for 10%, English 3 (you, I, the).
 *
 * ZIPF_WORDS_FOR is a different, also-sourced measure (book corpus, dictionary
 * forms) used by the /frequent-words table. Don't mix the two up.
 *
 * Honesty rule for copy: "about 1 in every 10 words you'll hear", never "10% of
 * the language". The first words are glue words: everywhere, little meaning.
 */

/** Words needed for this share of running text (Oxford English Corpus Zipf fit, lemmas). */
export const ZIPF_WORDS_FOR: Record<10 | 20 | 30 | 40 | 50, number> = {
  10: 2,
  20: 4,
  30: 13,
  40: 36,
  50: 100,
};

/**
 * Top-N words covering 10 / 20 / 30 / 40 / 50% of film & TV speech.
 * Output of scripts/measure-speed-run-cuts.ts (Nov 2026). No list upstream for th.
 */
export const SPEED_RUN_CUTS: Record<string, [number, number, number, number, number]> = {
  en: [3, 8, 18, 34, 61],
  es: [4, 9, 19, 42, 95],
  fr: [5, 12, 21, 36, 64],
  de: [4, 11, 25, 48, 91],
  it: [4, 12, 28, 60, 123],
  pt: [4, 9, 19, 42, 89],
  zh: [3, 8, 26, 65, 161],
  ja: [6, 18, 42, 88, 170],
  ko: [29, 95, 253, 666, 1767],
  ar: [8, 27, 79, 221, 613],
  hi: [3, 9, 18, 32, 63],
  ru: [4, 12, 30, 75, 187],
  tr: [9, 30, 85, 216, 523],
  nl: [4, 8, 18, 34, 63],
  pl: [4, 13, 37, 93, 244],
  sv: [3, 8, 17, 30, 58],
};

/**
 * Courses longer than this (in total words) are left out: Speed Run is about
 * quick wins. Korean, Arabic and Turkish glue small parts onto words, so each
 * exact form is rarer and 50% needs hundreds of forms — those learners stop
 * earlier and carry on in the Top-50 decks.
 */
export const MAX_SPEED_RUN_WORDS = 250;

export interface SpeedRunCourse {
  n: number;          // course number, 1-based
  pct: number;        // share of film/TV words covered after finishing it
  from: number;       // first frequency rank (inclusive)
  to: number;         // last frequency rank (inclusive)
  title: string;
  /** What the learner can honestly say afterwards. */
  win: string;
}

const WIN = [
  "You know about 1 in every 10 words you'll hear in films and TV.",
  "You know about 2 in every 10 words you'll hear.",
  "About 3 in every 10 words you hear are now yours.",
  "4 in every 10 words you hear: the glue of every sentence.",
  "About half of every sentence you hear is a word you know.",
];

export function speedRunFor(lang: string): SpeedRunCourse[] {
  const cuts = SPEED_RUN_CUTS[lang];
  if (!cuts) return [];
  const courses: SpeedRunCourse[] = [];
  cuts.forEach((to, i) => {
    if (to > MAX_SPEED_RUN_WORDS) return;
    const from = i === 0 ? 1 : cuts[i - 1] + 1;
    courses.push({
      n: i + 1,
      pct: (i + 1) * 10,
      from,
      to,
      title: i === 0 ? `Your first ${to} words` : `The top ${to}`,
      win: WIN[i],
    });
  });
  return courses;
}

/** True when this language stops before 50% because of MAX_SPEED_RUN_WORDS. */
export const speedRunCutShort = (lang: string) => {
  const cuts = SPEED_RUN_CUTS[lang];
  return !!cuts && cuts[4] > MAX_SPEED_RUN_WORDS;
};

export const wordsIn = (c: SpeedRunCourse) => c.to - c.from + 1;

/** New words shown per practice round (keeps a round under ~3 minutes). */
export const ROUND_SIZE = 10;

/**
 * SMART goal for a course, from the learner's own daily word goal.
 * S = these exact words · M = x / y learned · A = paced by THEIR daily goal ·
 * R = their onboarding goal · T = a real date.
 */
export function smartDeadline(course: SpeedRunCourse, dailyWordGoal: number, start: Date): Date {
  const perDay = Math.max(1, Math.round(dailyWordGoal) || 5);
  const days = Math.max(1, Math.ceil(wordsIn(course) / perDay));
  const d = new Date(start);
  d.setDate(d.getDate() + days - 1); // finishing today counts as day 1
  return d;
}

const startKey = (lang: string, n: number) => `ls.speedRun.start.${lang}.${n}`;

/** When the learner first opened this course (saved on this device). */
export function courseStart(lang: string, n: number): Date {
  try {
    const saved = localStorage.getItem(startKey(lang, n));
    if (saved) return new Date(saved);
    const now = new Date();
    localStorage.setItem(startKey(lang, n), now.toISOString());
    return now;
  } catch {
    return new Date();
  }
}

// ---------------------------------------------------------------------------
// Lesson content: sentence building, verb cards and word roots.
// Glosses are English UI text (AutoTranslate turns them into the learner's
// native language). Learning-language text is rendered translate="no".
// ---------------------------------------------------------------------------

export interface BuildItem {
  /** Tiles in the right order. Punctuation stays on its tile. */
  tiles: string[];
  gloss: string;
  /** Tiles that look like the English word (shown only to English speakers). */
  cognates?: string[];
  /** A short "did you know" shown when the sentence is built. */
  fact?: string;
}

export interface VerbCard {
  verb: string;
  meaning: string;
  forms: [string, string][];
  /** The form(s) that are in this course's word list. */
  inLesson: string[];
  note: string;
}

export interface CourseLesson {
  verb?: VerbCard;
  build: BuildItem[];
}

const ETRE: VerbCard = {
  verb: "être", meaning: "to be",
  forms: [["je", "suis"], ["tu", "es"], ["il / elle", "est"], ["nous", "sommes"], ["vous", "êtes"], ["ils / elles", "sont"]],
  inLesson: ["est"],
  note: "“est” is in your top 5. It's one form of être, the most useful verb in French. Here are all six.",
};

const SER: VerbCard = {
  verb: "ser", meaning: "to be (what something is)",
  forms: [["yo", "soy"], ["tú", "eres"], ["él / ella", "es"], ["nosotros", "somos"], ["vosotros", "sois"], ["ellos / ellas", "son"]],
  inLesson: ["es"],
  note: "“es” is one form of ser. Spanish has two verbs for “to be”. Ser is for what something is.",
};

const ESTAR: VerbCard = {
  verb: "estar", meaning: "to be (how or where)",
  forms: [["yo", "estoy"], ["tú", "estás"], ["él / ella", "está"], ["nosotros", "estamos"], ["vosotros", "estáis"], ["ellos / ellas", "están"]],
  inLesson: ["está", "estoy"],
  note: "Estar is the other “to be”: for how you feel and where you are. Estoy cansado = I'm tired (right now).",
};

const SEIN: VerbCard = {
  verb: "sein", meaning: "to be",
  forms: [["ich", "bin"], ["du", "bist"], ["er / sie / es", "ist"], ["wir", "sind"], ["ihr", "seid"], ["sie / Sie", "sind"]],
  inLesson: ["ist"],
  note: "“ist” is in your top 4. It's one form of sein, the most useful verb in German.",
};

const ESSERE: VerbCard = {
  verb: "essere", meaning: "to be",
  forms: [["io", "sono"], ["tu", "sei"], ["lui / lei", "è"], ["noi", "siamo"], ["voi", "siete"], ["loro", "sono"]],
  inLesson: ["è"],
  note: "“è” is one form of essere, the most useful verb in Italian. Here are all six.",
};

const HUNGRY = "Fun fact: French doesn't say “I am hungry”. It says “I have hunger”: j'ai faim. Hungry is something you have!";

export const LESSONS: Record<string, Record<number, CourseLesson>> = {
  fr: {
    1: {
      verb: ETRE,
      build: [
        { tiles: ["Je", "suis", "fatigué."], gloss: "I am tired." },
        { tiles: ["Le", "film", "est", "excellent."], gloss: "The film is excellent.", cognates: ["film", "excellent."] },
        { tiles: ["Je", "suis", "de", "Paris."], gloss: "I'm from Paris." },
        { tiles: ["Je", "ne", "suis", "pas", "fatigué."], gloss: "I'm not tired.", fact: "French wraps “not” around the verb: ne … pas. In speech people often drop the ne." },
      ],
    },
    2: {
      build: [
        { tiles: ["C'est", "la", "vie."], gloss: "That's life." },
        { tiles: ["Tu", "es", "à", "Paris", "?"], gloss: "Are you in Paris?" },
        { tiles: ["Vous", "êtes", "fatigué", "?"], gloss: "Are you tired? (polite)", fact: "Vous is polite or for several people; tu is for one friend." },
        { tiles: ["C'est", "un", "accident."], gloss: "It's an accident.", cognates: ["accident."] },
      ],
    },
    3: {
      build: [
        { tiles: ["Je", "suis", "fatigué", "et", "j'ai", "faim."], gloss: "I'm tired and I'm hungry.", fact: HUNGRY },
        { tiles: ["Il", "est", "grand", "et", "intelligent."], gloss: "He is tall and clever.", cognates: ["intelligent."] },
        { tiles: ["On", "a", "un", "problème."], gloss: "We have a problem.", cognates: ["problème."], fact: "“On” means “we” in everyday French." },
      ],
    },
    4: {
      build: [
        { tiles: ["pour", "la", "France", "et", "la", "Belgique"], gloss: "for France and Belgium", cognates: ["France"] },
        { tiles: ["Ce", "n'est", "pas", "possible", "!"], gloss: "That's not possible!", cognates: ["possible"] },
        { tiles: ["Elle", "est", "dans", "le", "train."], gloss: "She is on the train.", cognates: ["train."] },
      ],
    },
    5: {
      build: [
        { tiles: ["du", "sel", "et", "du", "sucre"], gloss: "salt and sugar", cognates: ["sucre"], fact: "Same roots! Sel and salt come from one ancient word, *sal-. Sucre and sugar both travelled from the Arabic sukkar." },
        { tiles: ["Je", "ne", "sais", "pas."], gloss: "I don't know." },
        { tiles: ["Oui,", "ça", "va", "bien."], gloss: "Yes, I'm doing well." },
        { tiles: ["C'est", "plus", "important."], gloss: "It's more important.", cognates: ["important."] },
      ],
    },
  },
  es: {
    1: {
      build: [
        { tiles: ["Soy", "de", "Madrid."], gloss: "I'm from Madrid." },
        { tiles: ["Creo", "que", "no."], gloss: "I don't think so." },
        { tiles: ["Voy", "a", "Madrid."], gloss: "I'm going to Madrid." },
      ],
    },
    2: {
      verb: SER,
      build: [
        { tiles: ["El", "chocolate", "es", "delicioso."], gloss: "The chocolate is delicious.", cognates: ["chocolate", "delicioso."] },
        { tiles: ["La", "casa", "es", "grande."], gloss: "The house is big." },
        { tiles: ["Tú", "y", "yo"], gloss: "You and me" },
      ],
    },
    3: {
      build: [
        { tiles: ["¿Por", "qué", "no?"], gloss: "Why not?" },
        { tiles: ["Me", "gusta", "el", "café."], gloss: "I like coffee.", cognates: ["café."], fact: "Spanish says “coffee pleases me”: me gusta." },
      ],
    },
    4: {
      verb: ESTAR,
      build: [
        { tiles: ["Estoy", "muy", "bien."], gloss: "I'm very well." },
        { tiles: ["Estoy", "cansado", "y", "tengo", "hambre."], gloss: "I'm tired and I'm hungry.", fact: "Spanish also says “I have hunger”: tengo hambre." },
      ],
    },
    5: {
      build: [
        { tiles: ["Hola,", "¿cómo", "estás?"], gloss: "Hi, how are you?" },
        { tiles: ["Es", "muy", "importante."], gloss: "It's very important.", cognates: ["importante."] },
      ],
    },
  },
  de: {
    1: {
      verb: SEIN,
      build: [
        { tiles: ["Ich", "bin", "müde."], gloss: "I'm tired." },
        { tiles: ["Das", "ist", "perfekt."], gloss: "That's perfect.", cognates: ["perfekt."] },
        { tiles: ["Sie", "ist", "hier."], gloss: "She is here." },
      ],
    },
    2: {
      build: [
        { tiles: ["Das", "ist", "nicht", "gut."], gloss: "That's not good." },
        { tiles: ["Du", "und", "ich"], gloss: "You and me" },
        { tiles: ["Der", "Film", "ist", "super."], gloss: "The film is great.", cognates: ["Film", "super."] },
      ],
    },
    3: {
      build: [
        { tiles: ["Ich", "bin", "müde", "und", "ich", "habe", "Hunger."], gloss: "I'm tired and I'm hungry.", cognates: ["Hunger."], fact: "German also says “I have hunger”, and Hunger is the same old word as English hunger." },
        { tiles: ["Was", "ist", "das?"], gloss: "What is that?" },
      ],
    },
  },
  it: {
    1: {
      build: [
        { tiles: ["Sono", "di", "Roma."], gloss: "I'm from Rome." },
        { tiles: ["Non", "so."], gloss: "I don't know." },
        { tiles: ["Io", "e", "te"], gloss: "Me and you" },
      ],
    },
    2: {
      verb: ESSERE,
      build: [
        { tiles: ["Il", "film", "è", "fantastico."], gloss: "The film is fantastic.", cognates: ["film", "fantastico."] },
        { tiles: ["La", "pizza", "è", "per", "te."], gloss: "The pizza is for you.", cognates: ["pizza"] },
      ],
    },
    3: {
      build: [
        { tiles: ["Sono", "stanco", "e", "ho", "fame."], gloss: "I'm tired and I'm hungry.", fact: "Italian also says “I have hunger”: ho fame." },
        { tiles: ["Non", "è", "possibile!"], gloss: "It's not possible!", cognates: ["possibile!"] },
      ],
    },
  },
};

/**
 * Word roots shared with English, shown once (in `course`) to English speakers.
 * French claim, audited: in the Shorter Oxford, about 28% of English words come
 * from French and about 28% from Latin, French's parent (Finkenstaedt & Wolff,
 * 1973, Ordered Profusion). That's dictionary words: the everyday top 100 are
 * mostly Old English, so the win comes with longer words.
 */
export interface RootTip {
  course: number;
  headline: string;
  body: string;
  source?: { label: string; href: string };
  patterns: [string, string][]; // [English, learning language]
  falseFriend?: string;
}

export const ROOTS: Record<string, RootTip> = {
  fr: {
    course: 3,
    headline: "You already know thousands of French words",
    body: "About 3 in 10 English words come from French, and about 3 in 10 more come from Latin, French's parent. Most are longer words, so learn these patterns and they open up fast.",
    source: { label: "Finkenstaedt & Wolff (1973), Ordered Profusion", href: "https://en.wikipedia.org/wiki/Foreign_language_influences_in_English" },
    patterns: [["nation → -tion", "nation"], ["liberty → -ty becomes -té", "liberté"], ["famous → -ous becomes -eux", "fameux"], ["rapidly → -ly becomes -ment", "rapidement"], ["possible → same", "possible"]],
    falseFriend: "Watch out for false friends: une librairie is a bookshop, not a library!",
  },
  es: {
    course: 3,
    headline: "English and Spanish share thousands of Latin words",
    body: "Many longer English words come from Latin, Spanish's parent. Learn the patterns and they're yours.",
    patterns: [["nation → -tion becomes -ción", "nación"], ["city → -ty becomes -dad", "ciudad"], ["famous → -ous becomes -oso", "famoso"], ["rapidly → -ly becomes -mente", "rápidamente"]],
    falseFriend: "False friend: embarazada means pregnant, not embarrassed!",
  },
  it: {
    course: 3,
    headline: "English and Italian share thousands of Latin words",
    body: "Many longer English words come from Latin, Italian's parent. Learn the patterns and they're yours.",
    patterns: [["nation → -tion becomes -zione", "nazione"], ["city → -ty becomes -tà", "città"], ["famous → -ous becomes -oso", "famoso"], ["rapidly → -ly becomes -mente", "rapidamente"]],
    falseFriend: "False friend: camera means bedroom!",
  },
  de: {
    course: 2,
    headline: "German is English's cousin",
    body: "English and German grew from the same old language, so many everyday words still match.",
    patterns: [["house", "Haus"], ["hand", "Hand"], ["water", "Wasser"], ["good", "gut"], ["bring", "bringen"]],
    falseFriend: "False friend: das Gift means poison, not a present!",
  },
};

/** Split a tile into the dictionary tokens it contains: "j'ai" → ["j'", "ai"]. */
export function tokensOf(tile: string): string[] {
  return (tile.toLowerCase().match(/\p{L}+['’]|\p{L}+/gu) ?? []).map((t) => t.replace("’", "'"));
}
