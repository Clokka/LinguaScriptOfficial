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
  loadGrowth();
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

// "Circle common words": the current Common Words deck (Top 50, 100, 150…) is
// circled in videos. ls-core.js writes ls_ring_status so we can say which deck.
async function showRings() {
  const { ls_rings: on = true, ls_ring_status: st } = await chrome.storage.local.get(['ls_rings', 'ls_ring_status']);
  $('rings-switch').setAttribute('aria-checked', String(on !== false));
  const text = $('rings-text');
  if (on === false) text.textContent = 'Off. Turn it on to circle the most common words you haven’t saved yet, 50 at a time.';
  else if (st?.done) text.textContent = 'You’ve saved every common word in the list. Amazing! 🎉';
  else if (st?.band) text.textContent = `Now circling: Top ${st.band} · ${st.left} word${st.left === 1 ? '' : 's'} left to save. Save them all to unlock Top ${st.band + 50}.`;
}
$('rings-switch').addEventListener('click', async () => {
  const on = $('rings-switch').getAttribute('aria-checked') !== 'true';
  await chrome.storage.local.set({ ls_rings: on });
  showRings();
});
showRings();

// ─── Vocabulary growth + Share my progress ───────────────────────────────────
// background.js getProgress: share of all words spoken in films & TV that are
// in the learner's decks, from real OpenSubtitles counts (never typed numbers).
// The share card is a testimonial: "In 3 weeks I went from 0% to 58%".
let growth = null;
const pct = (n) => `${n >= 10 || n === 0 ? n.toFixed(0) : n.toFixed(1)}%`;
const langOnly = (c) => LANGUAGES[c]?.[0] || String(c || '').toUpperCase();
function spanText(days) {
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}
// The story for the share card. Known words lead; a brand-new learner with
// only red words gets the "collected" line instead, so it is never overstated.
function story(g) {
  const lang = langOnly(g.language);
  const first = g.series[0] || { known: 0, decks: 0 };
  const useKnown = g.known >= 1;
  const from = useKnown ? first.known : first.decks;
  const to = useKnown ? g.known : g.decks;
  const what = useKnown ? `of the words in ${lang} films & TV are now words I know` : `of the words in ${lang} films & TV are now in my flashcards`;
  return { lang, from, to, what, span: spanText(g.days), useKnown };
}
function shareText(g) {
  const s = story(g);
  return `In ${s.span} with LinguaScript I went from ${pct(s.from)} to ${pct(s.to)} — ${pct(s.to)} ${s.what} 🦎📈 linguascript.co.uk`;
}

async function loadGrowth() {
  const g = await send({ type: 'GET_PROGRESS' });
  if (!g?.ok || !g.supported) { $('growth-card').classList.add('hidden'); return; }
  growth = g;
  const lang = langOnly(g.language);
  $('growth-card').classList.remove('hidden');
  $('growth-known').textContent = pct(g.known);
  $('growth-what').textContent = `of the words in ${lang} films & TV are words you know`;
  $('growth-known-bar').style.width = `${g.known}%`;
  $('growth-decks-bar').style.width = `${g.decks}%`;
  const extra = Math.max(0, g.decks - g.known);
  $('growth-decks').textContent = extra >= 0.1
    ? `+${pct(extra)} more waiting in your red & orange decks — review them to turn them green.`
    : 'Save words while you watch to grow this number.';
  const wk = g.known >= 1 ? g.weekGain.known : g.weekGain.decks;
  $('growth-week').textContent = wk >= 0.05 ? `+${pct(wk)} this week` : '';
  $('growth-next').textContent = g.next.count
    ? `⭕ Save the next ${g.next.count} most common words: +${pct(g.next.gain)}`
    : '';
  drawSpark(g.series);
  $('share-btn').disabled = g.decks < 0.5;
}

function drawSpark(series) {
  const svg = $('growth-spark');
  if (!series || series.length < 2) { svg.innerHTML = ''; return; }
  const max = Math.max(1, ...series.map((p) => p.decks));
  const line = (key) => series.map((p, i) => `${(i / (series.length - 1) * 280).toFixed(1)},${(36 - p[key] / max * 34).toFixed(1)}`).join(' ');
  svg.innerHTML = `<polyline points="${line('decks')}" fill="none" stroke="rgba(255,138,0,0.6)" stroke-width="2" vector-effect="non-scaling-stroke"/>` +
    `<polyline points="${line('known')}" fill="none" stroke="#34C759" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`;
}

// 1080×1350 card (Instagram portrait), drawn on a canvas so it works offline.
async function shareImage(g) {
  const s = story(g);
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const font = (w, px) => `${w} ${px}px Inter, system-ui, -apple-system, sans-serif`;
  const grd = x.createLinearGradient(0, 0, 0, H); grd.addColorStop(0, '#0B0B0F'); grd.addColorStop(1, '#101A12');
  x.fillStyle = grd; x.fillRect(0, 0, W, H);
  // Logo (the same SVG as the pop-up header).
  await new Promise((done) => {
    const img = new Image();
    img.onload = () => { const h = 120, w = h * (img.naturalWidth / img.naturalHeight || 2); x.drawImage(img, 80, 80, w, h); done(); };
    img.onerror = done;
    // As a data: URL so the canvas never counts as "tainted" and can export.
    fetch('icons/logo.svg').then((r) => r.text())
      .then((svg) => { img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; })
      .catch(done);
  });
  x.fillStyle = '#F5F5F7'; x.font = font(800, 54); x.fillText('Lingua', 330, 160);
  const lw = x.measureText('Lingua').width; x.fillStyle = '#34C759'; x.fillText('Script', 330 + lw, 160);
  x.fillStyle = '#A1A1AA'; x.font = font(600, 44); x.fillText(`In ${s.span} of learning ${s.lang}`, 80, 340);
  // From → to.
  x.font = font(800, 120); x.fillStyle = '#71717A'; x.fillText(pct(s.from), 80, 520);
  const fw = x.measureText(pct(s.from)).width;
  x.fillStyle = '#F5F5F7'; x.font = font(700, 90); x.fillText('→', 110 + fw, 510);
  x.font = font(900, 230); x.fillStyle = '#34C759'; x.fillText(pct(s.to), 80, 760);
  // Wrap the sentence.
  x.fillStyle = '#F5F5F7'; x.font = font(700, 52);
  const words = s.what.replace(/^of/, 'of').split(' '); let line = '', y = 860;
  for (const w of words) {
    if (x.measureText(line + w).width > W - 160) { x.fillText(line.trim(), 80, y); line = ''; y += 66; }
    line += w + ' ';
  }
  x.fillText(line.trim(), 80, y);
  // Progress bar with 50 / 75 / 90 marks.
  const by = 1080, bw = W - 160;
  x.fillStyle = '#1F1F27'; x.beginPath(); x.roundRect(80, by, bw, 36, 18); x.fill();
  x.fillStyle = 'rgba(255,138,0,0.45)'; x.beginPath(); x.roundRect(80, by, Math.max(36, bw * g.decks / 100), 36, 18); x.fill();
  if (s.useKnown) { x.fillStyle = '#34C759'; x.beginPath(); x.roundRect(80, by, Math.max(36, bw * g.known / 100), 36, 18); x.fill(); }
  x.fillStyle = '#A1A1AA'; x.font = font(600, 28);
  for (const m of [50, 75, 90]) { x.textAlign = 'center'; x.fillText(`${m}%`, 80 + bw * m / 100, by + 80); }
  x.textAlign = 'left';
  x.fillStyle = '#F5F5F7'; x.font = font(800, 40); x.fillText('linguascript.co.uk', 80, 1250);
  x.fillStyle = '#71717A'; x.font = font(500, 22);
  x.fillText('Share of all words spoken in films & TV · OpenSubtitles 2018 (CC BY-SA 4.0)', 80, 1295);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

$('share-btn').addEventListener('click', async () => {
  if (!growth) return;
  const btn = $('share-btn'); const note = $('share-note');
  btn.disabled = true; btn.textContent = 'Making your card…';
  const text = shareText(growth);
  try {
    const blob = await shareImage(growth);
    const file = new File([blob], 'my-linguascript-progress.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text });
      note.textContent = 'Thanks for sharing! 🦎';
    } else {
      await navigator.clipboard.writeText(text).catch(() => {});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      note.textContent = 'Image saved and words copied — paste them into your post! 🦎';
    }
  } catch (e) {
    if (e?.name !== 'AbortError') note.textContent = 'Couldn’t make the card. Try again.';
  }
  note.classList.remove('hidden');
  btn.disabled = false; btn.textContent = 'Share my progress';
});
