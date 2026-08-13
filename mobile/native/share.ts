import * as Sharing from 'expo-sharing';
import { Share, Platform } from 'react-native';

/**
 * Native share sheet. Use the system Share API for text (works on both iOS
 * and Android). expo-sharing is for file URIs.
 */
export async function shareText(
  message: string,
  opts: { title?: string; url?: string } = {},
): Promise<void> {
  try {
    await Share.share(
      Platform.select({
        ios: { message, url: opts.url },
        default: { message: opts.url ? `${message}\n${opts.url}` : message, title: opts.title },
      })!,
    );
  } catch (e) {
    console.warn('shareText failed', e);
  }
}

export async function shareFile(uri: string, mimeType?: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) return;
  await Sharing.shareAsync(uri, { mimeType });
}

export function shareWord(word: string, translation?: string | null): Promise<void> {
  const line = translation
    ? `"${word}" → ${translation}\n\nSaved with LinguaScript 🦎`
    : `"${word}" — saved with LinguaScript 🦎`;
  return shareText(line, {
    title: 'Word from LinguaScript',
    url: 'https://linguascript.xyz',
  });
}

export function shareFriendInvite(friendCode: string): Promise<void> {
  const url = `https://linguascript.xyz/?addFriend=${friendCode}`;
  return shareText(
    `Join me on LinguaScript — my friend code is ${friendCode}. Add me and let's compete on the leaderboard.`,
    { title: 'Add me on LinguaScript', url },
  );
}
