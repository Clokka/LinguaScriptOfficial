import { setPendingLink } from '@/lib/pendingLink';

// expo-router calls this for every link that opens the app, BEFORE it routes.
// Widget squares, the gold strip and the lock-screen card open
// linguascript://open/flashcards?deck=… — left alone, expo-router opened that as
// its own screen, the WebView screen was unmounted, and the site reloaded on the
// HOME page. Instead: stay on the WebView screen ("/") and let app/index.tsx
// send the site to the right page. Same for https://linguascript.co.uk/… links.
// Sign-in (linguascript://auth-callback) is left to its own screen.
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    if (/^linguascript:\/\/\/?open\b/.test(path) || /^\/?open\//.test(path) || /^https:\/\/(www\.)?linguascript\.co\.uk/.test(path)) {
      const full = path.startsWith('linguascript:') || path.startsWith('https:') ? path : `linguascript://${path.replace(/^\//, '')}`;
      setPendingLink(full);
      return '/';
    }
  } catch { /* fall through */ }
  return path;
}
