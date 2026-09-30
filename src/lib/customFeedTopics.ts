import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-curated recommendation topics for one learner (public.custom_feed_topics).
 * Where onboarding interests are broad ("Art & Design"), these carry exact
 * search phrases per learning language ("ceramica al tornio"), so a customer
 * we know well gets a feed built around them. Rendered by PersonalizedRails
 * above the onboarding-interest rails.
 */
export interface CustomFeedTopic {
  id: string;
  user_id: string;
  label: string;
  emoji: string;
  /** Learning-language code (lowercase) → search phrases, searched as written. */
  queries: Record<string, string[]>;
  fallback_query: string | null;
  position: number;
}

/** Rail id for a custom topic — also the interest_id its click signals are stored under (≤ 40 chars). */
export function customTopicRailId(topic: Pick<CustomFeedTopic, "id">): string {
  return `c:${topic.id}`;
}

export async function fetchCustomFeedTopics(userId: string): Promise<CustomFeedTopic[]> {
  const { data, error } = await (supabase as any)
    .from("custom_feed_topics")
    .select("id, user_id, label, emoji, queries, fallback_query, position")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data as CustomFeedTopic[]) ?? [];
}

/**
 * Search phrases for a custom topic: the learning language's own phrases
 * first, then "<Language> <fallback>" so the topic still works if the
 * learner switches to a language nobody wrote phrases for.
 */
export function customTopicQueries(topic: CustomFeedTopic, lang: string, langLabel: string): string[] {
  const local = (topic.queries?.[lang.toLowerCase()] || []).map((q) => q.trim()).filter(Boolean);
  const fallback = topic.fallback_query?.trim() ? [`${langLabel} ${topic.fallback_query.trim()}`] : [];
  return [...local, ...fallback].slice(0, 3);
}
