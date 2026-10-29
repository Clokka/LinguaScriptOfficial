/**
 * Language packs for the promo videos. One pack = one market cut.
 * Add a pack (e.g. fr→en, en→ja) and every story renders in it — see Root.tsx.
 *
 * `state` per word: red (new) · orange (learning) · green (known) · gold (known, review due).
 */
export type Deck = "red" | "orange" | "green" | "gold";

export interface W { t: string; s?: Deck; tap?: boolean }

export interface Pack {
  id: string;
  /** Shown in captions: the language being learned, in the viewer's language. */
  learningName: string;
  /** Captions, in the viewer's own language. */
  captions: {
    watchHook: string; tapAny: string; savedRed: string; turnsGreen: string;
    webHook: string; webColour: string; webRings: string;
    phoneHook: string; tapBubble: string; tapWord: string; android: string;
    goldHook: string; goldDue: string; ladder: string;
    allHook: string[]; cta: string; tagline: string; free: string;
    later2d: string; later1w: string; later5m: string; gotIt: string; save: string; saved: string;
    colour: string; rings: string;
  };
  /** Subtitle line in the video player. */
  subtitle: W[];
  subtitleTranslation: string;
  /** The word tapped in the player and its meaning. */
  tapped: { word: string; meaning: string };
  /** Website article. */
  articleTitle: string;
  article: W[];
  /** Chat on the phone. */
  chat: { me: boolean; words: W[] }[];
  chatTapped: { word: string; meaning: string; sentence: string };
  /** Gold review word. */
  gold: { word: string; meaning: string };
}

const w = (s: string, state?: Deck, tap = false): W => ({ t: s, s: state, tap });

export const EN_FR: Pack = {
  id: "en-fr",
  learningName: "French",
  captions: {
    watchHook: "Learn French from what you already watch",
    tapAny: "Tap any word",
    savedRed: "Saved. Red means new.",
    turnsGreen: "Review it. Watch it turn green.",
    webHook: "Every website becomes a French lesson",
    webColour: "Your words, in colour",
    webRings: "Or rings. You choose.",
    phoneHook: "Your French words, glowing in every app",
    tapBubble: "Tap the bubble",
    tapWord: "Tap a word to save it",
    android: "On Android",
    goldHook: "Gold means: review me",
    goldDue: "Known words come back gold",
    ladder: "1 · 3 · 7 · 14 · 30 days… then further apart, forever",
    allHook: ["Watch.", "Read.", "Tap.", "Turn French green."],
    cta: "linguascript.co.uk",
    tagline: "Watch the language turn green.",
    free: "Free to start",
    later2d: "2 days later",
    later1w: "1 week later",
    later5m: "5 minutes later",
    gotIt: "Got it",
    save: "Save",
    saved: "Saved",
    colour: "Colour",
    rings: "Rings",
  },
  subtitle: [w("On"), w("se"), w("retrouve", "gold"), w("à"), w("la"), w("gare", undefined, true), w("demain", "green"), w("matin", "green"), w("?")],
  subtitleTranslation: "Shall we meet at the station tomorrow morning?",
  tapped: { word: "gare", meaning: "station" },
  articleTitle: "Paris en train : le guide",
  article: [
    w("Prendre"), w("le"), w("train", "green"), w("à"), w("Paris", undefined), w("est"), w("simple."),
    w("Achetez"), w("votre"), w("billet", "orange"), w("en"), w("ligne,"), w("arrivez"), w("tôt", "red"), w("à"), w("la"), w("gare", "red"),
    w("et"), w("gardez"), w("votre"), w("valise", "red"), w("près"), w("de"), w("vous."),
    w("S'il"), w("va"), w("pleuvoir,", "gold"), w("prenez"), w("un"), w("parapluie", "orange"), w("—"), w("le"), w("voyage", "green"), w("sera", "green"), w("parfait.")
  ],
  chat: [
    { me: false, words: [w("Salut"), w("!"), w("On"), w("se"), w("retrouve", "gold"), w("à"), w("la"), w("gare", "red"), w("demain", "green"), w("?")] },
    { me: true, words: [w("Oui"), w("!"), w("J'ai"), w("déjà", "green"), w("mon"), w("billet", "orange"), w(".")] },
    { me: false, words: [w("N'oublie"), w("pas"), w("ta"), w("valise", "red"), w(","), w("il"), w("va"), w("pleuvoir", "gold"), w(".")] },
    { me: true, words: [w("Je"), w("prends"), w("un"), w("parapluie", undefined, true), w("aussi"), w(".")] },
  ],
  chatTapped: { word: "parapluie", meaning: "umbrella", sentence: "Je prends un parapluie aussi." },
  gold: { word: "pleuvoir", meaning: "to rain" },
};

export const PACKS: Pack[] = [EN_FR];
