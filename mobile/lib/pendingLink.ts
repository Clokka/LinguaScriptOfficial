// A widget / gold-card / site link that arrived before the WebView screen
// could handle it (app/+native-intent.tsx stores it, app/index.tsx takes it).
let pending: string | null = null;
const listeners = new Set<(url: string) => void>();

export function setPendingLink(url: string) {
  pending = url;
  listeners.forEach((fn) => fn(url));
}

export function takePendingLink(): string | null {
  const url = pending;
  pending = null;
  return url;
}

export function onPendingLink(fn: (url: string) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
