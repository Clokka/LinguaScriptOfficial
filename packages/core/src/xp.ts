import type { LinguaScriptSupabaseClient } from './supabase';

export interface XpEvent {
  id?: string;
  user_id: string;
  amount: number;
  source: string;
  metadata?: Record<string, any> | null;
  created_at?: string;
}

export const XP_REWARDS = {
  FLASHCARD_CORRECT: 10,
  FLASHCARD_STREAK_5: 25,
  WORD_SAVED: 2,
  DAILY_GOAL_MET: 50,
  STREAK_MILESTONE: 100,
} as const;

export async function logXpEvent(
  client: LinguaScriptSupabaseClient,
  event: XpEvent,
): Promise<void> {
  const { error } = await (client as any).from('xp_events').insert(event);
  if (error) console.error('logXpEvent', error);
}

export async function logActivity(
  client: LinguaScriptSupabaseClient,
  userId: string,
  kind: string,
): Promise<void> {
  const day = new Date().toISOString().slice(0, 10);
  const { error } = await (client as any)
    .from('activity_log')
    .insert({ user_id: userId, day, kind });
  if (error && !error.message?.includes('duplicate')) console.error('logActivity', error);
}
