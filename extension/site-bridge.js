// LinguaScript — website bridge (linguascript.co.uk only)
// Lets the website sign in to the same account as the extension. The page
// (src/components/ExtensionAccountSync.tsx) asks over window.postMessage:
//   → { source: 'ls-site', type: 'hello' }    ← { type: 'account', user }
//   → { source: 'ls-site', type: 'handoff' }  ← { type: 'handoff', tokenHash }
// The handoff is a one-time sign-in token for the extension's account, never
// the extension's own tokens.
(() => {
  const ORIGIN = location.origin;
  const send = (msg) => new Promise((r) => chrome.runtime.sendMessage(msg, (res) => r(chrome.runtime.lastError ? null : res)));
  const reply = (data) => window.postMessage({ source: 'ls-extension', ...data }, ORIGIN);

  addEventListener('message', async (e) => {
    if (e.source !== window || e.origin !== ORIGIN || e.data?.source !== 'ls-site') return;
    if (e.data.type === 'hello') {
      const auth = await send({ type: 'GET_AUTH' });
      const u = auth?.session?.user;
      reply({ type: 'account', user: u ? { id: u.id, email: u.email } : null });
    } else if (e.data.type === 'handoff') {
      const res = await send({ type: 'SITE_HANDOFF' });
      reply({ type: 'handoff', tokenHash: res?.tokenHash || null, error: res?.ok ? null : (res?.error || 'Extension not signed in') });
    }
  });

  // The page may have said hello before this script loaded.
  reply({ type: 'ready' });
})();
