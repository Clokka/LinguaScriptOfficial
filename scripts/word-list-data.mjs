// Denominators from FrequencyWords/OpenSubtitles 2018 *_50k.txt files
// (Japanese: ja_full.txt, the project has no 50k file for it).
// The same denominator is used by build-word-lists.mjs, including filtered tokens.
// Source: https://github.com/hermitdave/FrequencyWords/tree/master/content/2018
export const CORPUS_TOTALS = {
  es: 413264052, fr: 312994233, de: 151705378,
  it: 241736295, pt_br: 419352664, en: 725119374,
  zh_cn: 81775831, ja: 3794284,
};

export function vocabularyCoverage(data, size) {
  const total = CORPUS_TOTALS[data.lang];
  if (!total || size > data.words.length || size < 1) throw new Error("Missing corpus data or invalid list size");
  return Math.round(data.words.slice(0, size).reduce((sum, word) => sum + word.c, 0) / total * 1000) / 10;
}

// Original teaching examples, not sentences lifted from the subtitle corpus.
export const FRENCH_EXAMPLES = [
  ["je", "Je suis ici.", "I am here."],
  ["tu", "Tu es avec moi.", "You are with me."],
  ["vous", "Vous avez un livre.", "You have a book."],
  ["on", "On est dans le train.", "We are on the train."],
  ["ne", "Je ne sais pas.", "I do not know."],
  ["ai", "J’ai une question.", "I have a question."],
  ["y", "J’y suis.", "I am there."],
  ["en", "J’en ai un.", "I have one of them."],
  ["du", "Je veux du pain.", "I want some bread."],
  ["des", "Il a des amis.", "He has friends."],
  ["bien", "Tu vas bien ?", "Are you well?"],
  ["au", "Je suis au cinéma.", "I am at the cinema."],
];

// Clarify ambiguous dictionary glosses without changing the frequency ranking.
export const FRENCH_MEANINGS = {
  ne: "negative particle, usually with pas", des: "some; of/from the (de + les)",
  du: "some; of/from the (de + le)", bien: "well; good", au: "to/at the (à + le)",
  son: "his/her/its; sound", été: "been; summer", vais: "go/am going (I)",
};