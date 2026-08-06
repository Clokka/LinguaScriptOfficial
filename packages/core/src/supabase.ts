import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type LinguaScriptSupabaseClient = SupabaseClient<Database>;

export interface CreateSupabaseOptions {
  url: string;
  anonKey: string;
  storage?: SupabaseClientOptions<'public'>['auth'] extends infer A
    ? A extends { storage?: infer S }
      ? S
      : never
    : never;
  autoRefreshToken?: boolean;
  detectSessionInUrl?: boolean;
}

export function createLinguaScriptClient(opts: CreateSupabaseOptions): LinguaScriptSupabaseClient {
  return createClient<Database>(opts.url, opts.anonKey, {
    auth: {
      storage: opts.storage,
      persistSession: true,
      autoRefreshToken: opts.autoRefreshToken ?? true,
      detectSessionInUrl: opts.detectSessionInUrl ?? false,
    },
  });
}
