import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createLinguaScriptClient } from '@linguascript/core';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Loud on-device error is better than a silent crash on splash.
  const missing = [!url && 'EXPO_PUBLIC_SUPABASE_URL', !anonKey && 'EXPO_PUBLIC_SUPABASE_ANON_KEY']
    .filter(Boolean)
    .join(', ');
  throw new Error(
    `Missing ${missing}. The APK was built without env vars. ` +
      'Commit mobile/.env or set the vars in EAS and rebuild.',
  );
}

const CHUNK_SIZE = 2000;

const secureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const total = await SecureStore.getItemAsync(`${key}::len`);
    if (!total) return SecureStore.getItemAsync(key);
    const parts: string[] = [];
    const count = Number(total);
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}::${i}`);
      if (part == null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.deleteItemAsync(`${key}::len`).catch(() => {});
      return SecureStore.setItemAsync(key, value);
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < chunks; i++) {
      await SecureStore.setItemAsync(
        `${key}::${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(`${key}::len`, String(chunks));
  },
  async removeItem(key: string): Promise<void> {
    const total = await SecureStore.getItemAsync(`${key}::len`);
    if (total) {
      for (let i = 0; i < Number(total); i++) {
        await SecureStore.deleteItemAsync(`${key}::${i}`).catch(() => {});
      }
      await SecureStore.deleteItemAsync(`${key}::len`).catch(() => {});
    }
    await SecureStore.deleteItemAsync(key).catch(() => {});
  },
};

const storage = Platform.OS === 'web' ? AsyncStorage : secureStoreAdapter;

export const supabase = createLinguaScriptClient({
  url,
  anonKey,
  storage,
  detectSessionInUrl: false,
});
