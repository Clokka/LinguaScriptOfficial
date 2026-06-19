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
  { id: "anime",           label: "Anime",             emoji: "🇯🇵", query: "anime" },
];

export const MAX_INTERESTS = 5;

export function interestById(id: string): Interest | undefined {
  return INTERESTS.find((i) => i.id === id);
}
