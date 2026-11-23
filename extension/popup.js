// LinguaScript popup: log in, or show today's goal and streak.

const $ = (id) => document.getElementById(id);

const LANGUAGES = {
  en: ['English', '🇬🇧'], es: ['Spanish', '🇪🇸'], fr: ['French', '🇫🇷'], de: ['German', '🇩🇪'], it: ['Italian', '🇮🇹'],
  pt: ['Portuguese', '🇵🇹'], ja: ['Japanese', '🇯🇵'], ko: ['Korean', '🇰🇷'], zh: ['Chinese', '🇨🇳'], ru: ['Russian', '🇷🇺'],
  ar: ['Arabic', '🇸🇦'], nl: ['Dutch', '🇳🇱'], pl: ['Polish', '🇵🇱'], sv: ['Swedish', '🇸🇪'], tr: ['Turkish', '🇹🇷'],
  hi: ['Hindi', '🇮🇳'], th: ['Thai', '🇹🇭'],
};
const langLabel = (c) => `${LANGUAGES[c]?.[1] || '🌐'} ${LANGUAGES[c]?.[0] || String(c).toUpperCase()}`;

const send = (msg) => new Promise((resolve) => {
  chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? null : res));
});

function show(panel) {
  $('auth-panel').classList.toggle('hidden', panel !== 'auth');
  $('main-panel').classList.toggle('hidden', panel !== 'main');
  $('logout-btn').classList.toggle('hidden', panel !== 'main');
}

async function loadToday() {
  const today = await send({ type: 'GET_TODAY' });
  if (!today?.ok) return;
  $('goal-saved').textContent = today.saved;
  $('goal-target').textContent = today.goal;
  $('goal-bar').style.width = `${Math.min(100, Math.round((today.saved / Math.max(1, today.goal)) * 100))}%`;
  $('streak').textContent = today.streak;
}

// The language this session watches in: only the learner's own LinguaScript
// languages, and asked for when there's more than one and none is picked yet.
async function loadLanguages() {
  const info = await send({ type: 'GET_LANGUAGES' });
  if (!info?.ok) return;
  const label = $('lang-label');
  label.innerHTML = '';
  if (!info.languages.length) {
    label.innerHTML = '<a href="https://linguascript.co.uk/profile" target="_blank" rel="noopener noreferrer">Add a language</a>';
  } else {
    label.append('Learning: ');
    const b = document.createElement('b'); b.textContent = langLabel(info.language); label.append(b);
  }
  $('lang-change').classList.toggle('hidden', info.languages.length < 2);
  const options = $('lang-options');
  options.innerHTML = '';
  info.languages.forEach((code) => {
    const btn = document.createElement('button');
    btn.className = 'lang-btn' + (code === info.language && !info.needsChoice ? ' on' : '');
    btn.textContent = langLabel(code);
    btn.addEventListener('click', async () => {
      const res = await send({ type: 'SET_LANGUAGE', language: code });
      if (!res?.ok) return;
      $('lang-picker').classList.add('hidden');
      loadLanguages();
      loadToday();
    });
    options.appendChild(btn);
  });
  $('lang-picker').classList.toggle('hidden', !info.needsChoice);
}

// ─── This page: switch LinguaScript on for any video site ─────────────────────
// Asks Chrome for just this one site (or the site's player origins), at the
// learner's click. Built-in sites (YouTube, Netflix, Crunchyroll, TV5MONDE)
// need nothing.
let siteOrigins = null;
let siteTabId = null;

function siteCard({ title, text, on = false, off = false }) {
  $('site-card').classList.remove('hidden');
  $('site-title').textContent = title;
  $('site-text').textContent = text;
  $('site-on').classList.toggle('hidden', !on);
  $('site-off').classList.toggle('hidden', !off);
}

async function loadSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab?.url || !/^https?:/.test(tab.url) || /chromewebstore\.google\.com|chrome\.google\.com\/webstore/.test(tab.url)) return;
  siteTabId = tab.id;
  const host = new URL(tab.url).hostname.replace(/^www\./, '');
  if (/(^|\.)youtube\.com$|(^|\.)netflix\.com$/.test(host)) {
    siteCard({ title: '✅ Works here', text: 'Play a video with subtitles (CC) and tap any word.' });
    return;
  }
  const known = self.LSSites?.siteFor(tab.url);
  const name = known?.name || host;
  siteOrigins = known ? known.origins : [self.LSSites.originPattern(tab.url)].filter(Boolean);
  const granted = known?.builtIn || (siteOrigins.length && await chrome.permissions.contains({ origins: siteOrigins }).catch(() => false));
  if (granted) {
    siteCard({
      title: `✅ On for ${name}`,
      text: known?.note || 'Turn on the video’s subtitles (CC). No subtitles? Press 📄 on the LinguaScript bar to load a .srt or .vtt file.',
      off: !known?.builtIn,
    });
  } else {
    siteCard({
      title: name,
      text: known
        ? `Turn LinguaScript on for ${name}: dual subtitles and tap a word to save it.`
        : 'Is there a video on this page? Turn LinguaScript on for this site to get dual subtitles and tap-to-save.',
      on: true,
    });
  }
}

$('site-on').addEventListener('click', () => {
  if (!siteOrigins?.length) return;
  // permissions.request must be the first thing the click does.
  chrome.permissions.request({ origins: siteOrigins }, async (ok) => {
    if (!ok) return;
    await send({ type: 'ENABLE_VIDEO_TAB', tabId: siteTabId });
    loadSite();
  });
});
$('site-off').addEventListener('click', () => {
  if (!siteOrigins?.length) return;
  chrome.permissions.remove({ origins: siteOrigins }, () => { send({ type: 'SYNC_VIDEO_SITES' }); loadSite(); });
});

// Translation line: Blurred (hover to read it, the default), Always or Off.
async function loadSecondary() {
  const { ls_secondary: mode = 'blur' } = await chrome.storage.local.get('ls_secondary');
  document.querySelectorAll('#secondary-options .lang-btn').forEach((b) => b.classList.toggle('on', b.dataset.mode === mode));
}
document.querySelectorAll('#secondary-options .lang-btn').forEach((b) => b.addEventListener('click', async () => {
  await chrome.storage.local.set({ ls_secondary: b.dataset.mode });
  loadSecondary();
}));
loadSecondary();

$('lang-change').addEventListener('click', () => $('lang-picker').classList.toggle('hidden'));

async function init() {
  const auth = await send({ type: 'GET_AUTH' });
  if (!auth?.session) { show('auth'); $('email').focus(); return; }
  show('main');
  $('user-email').textContent = auth.session.user?.email || '';
  loadLanguages();
  loadToday();
  loadSite();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  if (!email || !password) { $('auth-error').textContent = 'Enter your email and password.'; return; }
  $('login-btn').disabled = true;
  $('login-btn').textContent = 'Logging in…';
  $('auth-error').textContent = '';
  const res = await send({ type: 'SIGN_IN', email, password });
  $('login-btn').disabled = false;
  $('login-btn').textContent = 'Log in';
  if (!res?.ok) {
    // Accounts made with Google have no password yet.
    $('auth-error').textContent = /invalid login credentials/i.test(res?.error || '')
      ? 'Wrong email or password. Signed up with Google? Use "Continue with Google", or set a password with "Forgot password?" on linguascript.co.uk.'
      // "Failed to fetch" = the browser never reached the LinguaScript server (paused/down, network or ad blocker).
      : /failed to fetch|networkerror|load failed/i.test(res?.error || '')
        ? "Couldn't reach the LinguaScript server. Check your internet, turn off ad blockers for this site, and try again in a minute."
        : res?.error || 'Login failed. Check your email and password.';
    return;
  }
  $('password').value = '';
  // Shown small at the bottom, so it's easy to tell which copy of the extension this is.
$('ext-version').textContent = `LinguaScript extension v${chrome.runtime.getManifest().version}`;

init();
});

// Google sign-in happens on linguascript.co.uk (Google shows our domain); the
// site then signs the extension in. The pop-up shows it next time it opens.
$('google-btn').addEventListener('click', async () => {
  $('auth-error').textContent = '';
  const res = await send({ type: 'GOOGLE_SIGN_IN' });
  if (!res?.ok) $('auth-error').textContent = res?.error || 'Couldn’t open linguascript.co.uk. Try again or use email.';
});

$('logout-btn').addEventListener('click', async () => {
  await send({ type: 'SIGN_OUT' });
  show('auth');
});

// Shown small at the bottom, so it's easy to tell which copy of the extension this is.
$('ext-version').textContent = `LinguaScript extension v${chrome.runtime.getManifest().version}`;

init();
