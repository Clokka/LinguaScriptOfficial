// Words the automatic build can't get from Google, because the "translation" is the
// same word (moment, question, possible…) or the word is a tiny grammar word on its own.
// Used by build-instant-dict.mjs and patch-instant-dict.mjs.

/** Hand-written glosses for the most common grammar words and false friends (French → English). */
export const OVERRIDES = {
  fr: {
    ai: "have (I have)", as: "have (you have)", y: "there / in it", me: "me / to me", te: "you / to you", se: "oneself (himself, herself, themselves)",
    pu: "been able to", eu: "had", oh: "oh", eh: "hey", ok: "OK", hey: "hey",
    place: "place / square / seat", type: "guy / type", train: "train", pièce: "room / coin / piece", suppose: "suppose / I assume",
    continue: "continue / goes on", présent: "present", long: "long", général: "general", dr: "Dr.", mr: "Mr.",
  },
};

/** An English word list (top 50k) decides which look-alike words are real cognates worth keeping. */
export async function englishWords() {
  const raw = await (await fetch("https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt")).text();
  return new Set(raw.split("\n").map((l) => l.split(" ")[0]).filter(Boolean));
}
