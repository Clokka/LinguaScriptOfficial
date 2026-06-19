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
  { id: "football",     label: "Football",      emoji: "⚽", query: "football" },
  { id: "gaming",       label: "Gaming",        emoji: "🎮", query: "gaming" },
  { id: "history",      label: "History",       emoji: "📚", query: "history" },
  { id: "travel",       label: "Travel",        emoji: "✈️", query: "travel" },
  { id: "cooking",      label: "Cooking",       emoji: "🍳", query: "cooking" },
  { id: "films",        label: "Films",         emoji: "🎬", query: "films movies" },
  { id: "podcasts",     label: "Podcasts",      emoji: "🎤", query: "podcast" },
  { id: "anime",        label: "Anime",         emoji: "🎌", query: "anime" },
  { id: "business",     label: "Business",      emoji: "💼", query: "business" },
  { id: "fitness",      label: "Fitness",       emoji: "🏋️", query: "fitness workout" },
  { id: "comedy",       label: "Comedy",        emoji: "😂", query: "comedy" },
  { id: "news",         label: "News",          emoji: "📰", query: "news" },
  { id: "music",        label: "Music",         emoji: "🎵", query: "music" },
  { id: "cars",         label: "Cars",          emoji: "🚗", query: "cars" },
];

export const MAX_INTERESTS = 5;

export function interestById(id: string): Interest | undefined {
  return INTERESTS.find((i) => i.id === id);
}
