/**
 * Speed Run — five tiny courses that teach the most frequent words first.
 *
 * Course 1 = the top 2 words (≈ 1 word in every 10 you hear), course 2 = top 4
 * (≈ 2 in 10) … course 5 = top 100 (≈ half of every sentence). After that the
 * Top-50 decks on /flashcards/common carry on.
 *
 * Coverage numbers are the SAME sourced Zipf figures shown on /frequent-words
 * (Oxford English Corpus fit: top 10 ≈ 25%, top 100 ≈ 50%). FrequentWords.tsx
 * reads them from here, so the two pages can never disagree. Change them only
 * with a source.
 *
 * Honesty rule for copy: say "1 in every 10 words you hear", never "10% of the
 * language". The first words are little glue words (the, of, de, le); they are
 * everywhere but carry little meaning on their own.
 */

/** Words needed to recognise this share of running text (English Zipf fit). */
export const ZIPF_WORDS_FOR: Record<10 | 20 | 30 | 40 | 50, number> = {
  10: 2,
  20: 4,
  30: 13,
  40: 36,
  50: 100,
};

export interface SpeedRunCourse {
  n: number;          // course number, 1-based
  pct: number;        // coverage after finishing it
  from: number;       // first frequency rank (inclusive)
  to: number;         // last frequency rank (inclusive)
  title: string;
  /** What the learner can honestly say afterwards. */
  win: string;
}

export const SPEED_RUN: SpeedRunCourse[] = [
  { n: 1, pct: 10, from: 1, to: 2, title: "Your first 2 words", win: "You know about 1 in every 10 words you'll hear." },
  { n: 2, pct: 20, from: 3, to: 4, title: "2 more words", win: "You know about 2 in every 10 words you'll hear." },
  { n: 3, pct: 30, from: 5, to: 13, title: "The top 13", win: "Almost a third of every sentence is now familiar." },
  { n: 4, pct: 40, from: 14, to: 36, title: "The top 36", win: "4 in every 10 words are yours. The glue of every sentence." },
  { n: 5, pct: 50, from: 37, to: 100, title: "The top 100", win: "Half of every sentence you hear is a word you know." },
];

export const wordsIn = (c: SpeedRunCourse) => c.to - c.from + 1;

/** New words shown per practice round (keeps a round under ~3 minutes). */
export const ROUND_SIZE = 10;

/**
 * SMART goal for a course, from the learner's own daily word goal.
 * S = these exact words · M = x / y green · A = paced by THEIR daily goal ·
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

/**
 * A few short sentences for the very first words, so lesson 1 shows each word
 * at work, not alone on a card. Sentences use only very frequent words
 * (substitution-drill style: one frame, one slot changes). Keyed by the
 * dictionary form stored in core_vocabulary; words without sentences simply
 * skip the "see it in sentences" step. Glosses are English UI text
 * (AutoTranslate turns them into the learner's native language); English
 * sentences have no gloss because English is the language being learned.
 */
export const STARTER_SENTENCES: Record<string, Record<string, [string, string][]>> = {
  fr: {
    de: [["le café de Marie", "Marie's coffee"], ["la maison de Paul", "Paul's house"], ["un verre d'eau", "a glass of water"], ["Je viens de Paris.", "I come from Paris."]],
    le: [["le chat", "the cat"], ["la maison", "the house"], ["les amis", "the friends"], ["J'aime le film.", "I like the film."]],
    être: [["Je suis prêt.", "I am ready."], ["Tu es là ?", "Are you there?"], ["C'est bon !", "It's good!"]],
    et: [["toi et moi", "you and me"], ["le pain et le café", "the bread and the coffee"]],
    à: [["à Paris", "in Paris"], ["à demain !", "see you tomorrow!"], ["Je vais à l'école.", "I'm going to school."]],
    un: [["un chat", "a cat"], ["une maison", "a house"], ["un ami", "a friend"]],
  },
  es: {
    de: [["el café de María", "María's coffee"], ["la casa de Pablo", "Pablo's house"], ["Soy de Madrid.", "I'm from Madrid."]],
    el: [["el gato", "the cat"], ["la casa", "the house"], ["los amigos", "the friends"], ["Me gusta el café.", "I like coffee."]],
    que: [["Creo que sí.", "I think so."], ["el libro que leo", "the book that I'm reading"]],
    y: [["tú y yo", "you and me"], ["pan y café", "bread and coffee"]],
    a: [["Voy a Madrid.", "I'm going to Madrid."], ["¡Hasta mañana!", "See you tomorrow!"]],
  },
  de: {
    der: [["der Hund", "the dog"], ["die Katze", "the cat"], ["das Haus", "the house"], ["Ich mag den Film.", "I like the film."]],
    und: [["du und ich", "you and me"], ["Brot und Kaffee", "bread and coffee"]],
    sein: [["Ich bin müde.", "I am tired."], ["Das ist gut!", "That's good!"]],
    in: [["in Berlin", "in Berlin"], ["im Haus", "in the house"]],
  },
  it: {
    di: [["il caffè di Maria", "Maria's coffee"], ["la casa di Paolo", "Paolo's house"], ["Sono di Roma.", "I'm from Rome."]],
    il: [["il gatto", "the cat"], ["la casa", "the house"], ["gli amici", "the friends"]],
    e: [["tu e io", "you and me"], ["pane e caffè", "bread and coffee"]],
    essere: [["Sono pronto.", "I'm ready."], ["È buono!", "It's good!"]],
  },
  pt: {
    de: [["o café da Maria", "Maria's coffee"], ["Sou de Lisboa.", "I'm from Lisbon."]],
    o: [["o gato", "the cat"], ["a casa", "the house"], ["os amigos", "the friends"]],
    e: [["você e eu", "you and me"], ["pão e café", "bread and coffee"]],
  },
  en: {
    the: [["the cat", ""], ["the house", ""], ["I like the film.", ""]],
    be: [["I am ready.", ""], ["You are here.", ""], ["It is good!", ""]],
    of: [["a cup of tea", ""], ["the end of the film", ""]],
    and: [["you and me", ""], ["bread and butter", ""]],
  },
};

export function sentencesFor(lang: string, word: string): [string, string][] {
  return STARTER_SENTENCES[lang]?.[word.toLowerCase()] ?? [];
}
