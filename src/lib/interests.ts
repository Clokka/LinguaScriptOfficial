/**
 * Interests captured during onboarding and used to seed the discovery /
 * recommendation feed. Stored on profiles.interests (TEXT[]).
 *
 * The `query` is a generic English noun appended to the user's learning
 * language for YouTube searches (e.g. "French" + "history" → "French history").
 * Localized queries can be layered on later without breaking the schema.
 */
export interface Interest {
  id: string;
  label: string;
  emoji: string;
  query: string;
}

export const INTERESTS: Interest[] = [
  { id: "gaming",          label: "Gaming",            emoji: "🎮", query: "gaming" },
  { id: "football",        label: "Football",          emoji: "⚽", query: "football" },
  { id: "fitness",         label: "Fitness",           emoji: "🏃", query: "fitness workout" },
  { id: "travel",          label: "Travel",            emoji: "✈️", query: "travel vlog" },
  { id: "cooking",         label: "Cooking",           emoji: "🍳", query: "cooking recipe" },
  { id: "music",           label: "Music",             emoji: "🎵", query: "music" },
  { id: "films",           label: "Films & TV",        emoji: "🎬", query: "films movies" },
  { id: "comedy",          label: "Comedy",            emoji: "🎭", query: "comedy" },
  { id: "history",         label: "History",           emoji: "📚", query: "history" },
  { id: "business",        label: "Business",          emoji: "💼", query: "business" },
  { id: "news",            label: "News",              emoji: "📰", query: "news" },
  { id: "podcasts",        label: "Podcasts",          emoji: "🎙️", query: "podcast" },
  { id: "cars",            label: "Cars",              emoji: "🚗", query: "cars" },
  { id: "art",             label: "Art & Design",      emoji: "🎨", query: "art design" },
  { id: "culture",         label: "Culture",           emoji: "🌍", query: "culture" },
  { id: "language",        label: "Language Learning", emoji: "📖", query: "language learning" },
  { id: "tech",            label: "Technology",        emoji: "📱", query: "technology" },
  { id: "entrepreneurship",label: "Entrepreneurship",  emoji: "📈", query: "entrepreneurship startup" },
  { id: "anime",           label: "Anime",             emoji: "🇯🇵", query: "anime dubbed" },
];

export const MAX_INTERESTS = 5;

export function interestById(id: string): Interest | undefined {
  return INTERESTS.find((i) => i.id === id);
}

/**
 * Native-language search phrases per interest. Searching in the target
 * language ("anime VF") finds real dubbed clips far better than
 * "French anime dubbed", which mostly returns English channels.
 */
const LOCAL_QUERIES: Record<string, Record<string, string[]>> = {
  anime: {
    fr: ["anime VF extrait", "anime en français VF"],
    es: ["anime doblaje latino escena", "anime en español latino"],
    it: ["anime doppiaggio italiano scena", "anime in italiano"],
    de: ["anime german dub szene", "anime auf deutsch"],
    pt: ["anime dublado cena", "anime dublado português"],
    ja: ["アニメ 名シーン", "アニメ 切り抜き"],
    zh: ["动漫 中文配音 片段", "动漫 国语"],
    ko: ["애니 한국어 더빙 명장면", "애니 더빙"],
    ru: ["аниме русская озвучка момент", "аниме на русском"],
    th: ["อนิเมะ พากย์ไทย", "อนิเมะ พากย์ไทย ฉาก"],
    tr: ["anime türkçe dublaj sahne"],
    pl: ["anime po polsku dubbing"],
    nl: ["anime nederlands nagesynchroniseerd"],
    ar: ["انمي مدبلج عربي مشهد"],
    hi: ["anime hindi dubbed scene"],
    sv: ["anime svenska dubbning"],
  },
  gaming: { fr: ["gaming FR"], es: ["gameplay en español"], de: ["gaming deutsch"], it: ["gameplay ita"], pt: ["gameplay português"] },
  football: { fr: ["football résumé"], es: ["fútbol resumen"], de: ["fußball highlights deutsch"], it: ["calcio highlights"], pt: ["futebol melhores momentos"] },
  cooking: { fr: ["recette facile"], es: ["receta fácil"], de: ["einfaches rezept"], it: ["ricetta facile"], pt: ["receita fácil"] },
  travel: { fr: ["vlog voyage"], es: ["vlog de viaje"], de: ["reise vlog"], it: ["vlog viaggio"], pt: ["vlog de viagem"] },
  comedy: { fr: ["sketch humour"], es: ["sketch comedia"], de: ["comedy sketch deutsch"], it: ["sketch comico"], pt: ["esquete comédia"] },
};

/** Search phrases for an interest: localized first, then the English fallback. */
export function interestQueries(interest: Interest, lang: string, langLabel: string): string[] {
  const local = LOCAL_QUERIES[interest.id]?.[lang.toLowerCase()] || [];
  return [...local, `${langLabel} ${interest.query}`].slice(0, 3);
}
