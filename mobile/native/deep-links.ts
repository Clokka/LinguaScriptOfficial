import * as Linking from 'expo-linking';
import { router } from 'expo-router';

/**
 * Parse an incoming deep link and route accordingly.
 * Supported:
 *   linguascript://friends?addFriend=CODE
 *   linguascript://vocab/add?word=…&lang=…
 *   https://linguascript.xyz/gift/XYZ
 *   https://linguascript.xyz/friends?addFriend=CODE
 */
export function handleDeepLink(url: string): void {
  const parsed = Linking.parse(url);
  const path = parsed.path ?? '';
  const params = parsed.queryParams ?? {};

  if (params.addFriend) {
    router.push({ pathname: '/(tabs)/profile', params: { addFriend: String(params.addFriend) } });
    return;
  }
  if (path.startsWith('gift/')) {
    const code = path.slice('gift/'.length);
    router.push({ pathname: '/(tabs)', params: { gift: code } });
    return;
  }
  if (path.startsWith('vocab/add')) {
    router.push({
      pathname: '/(tabs)/vocabulary',
      params: {
        addWord: params.word ? String(params.word) : '',
        lang: params.lang ? String(params.lang) : '',
      },
    });
    return;
  }
  router.push('/(tabs)');
}

export function useIncomingLinks(): void {
  const url = Linking.useURL();
  if (url) handleDeepLink(url);
}
